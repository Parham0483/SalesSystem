import json
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods, require_POST
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.conf import settings
from ratelimit.decorators import ratelimit
from datetime import timedelta

from ..utils import (
    generate_secure_token,
    check_rate_limit,
    get_client_ip,
    send_password_reset_email,
    log_security_event
)

Customer = get_user_model()


@method_decorator(never_cache, name='dispatch')
@ratelimit(key='ip', rate='5/h', method='POST')
def forgot_password_view(request):
    """Production forgot password view with comprehensive security"""

    if request.method == 'POST':
        email = request.POST.get('email', '').strip().lower()
        client_ip = get_client_ip(request)

        # Input validation
        if not email:
            messages.error(request, 'لطفاً ایمیل خود را وارد کنید')
            log_security_event('PASSWORD_RESET_INVALID_INPUT', 'Empty email', ip_address=client_ip)
            return render(request, 'auth/forgot_password.html')

        # Rate limiting check
        rate_limit_key = f"pwd_reset_{email.replace('@', '_').replace('.', '_')}"
        can_proceed, remaining = check_rate_limit(
            rate_limit_key,
            max_attempts=settings.PASSWORD_RESET_MAX_ATTEMPTS_PER_HOUR,
            window=settings.PASSWORD_RESET_RATE_LIMIT_WINDOW
        )

        if not can_proceed:
            messages.error(request, 'تعداد درخواست‌های شما زیاد است. لطفاً بعداً تلاش کنید.')
            log_security_event('PASSWORD_RESET_RATE_LIMITED', f'Email: {email}', ip_address=client_ip)
            return render(request, 'auth/forgot_password.html')

        try:
            customer = Customer.objects.get(email=email, is_active=True)

            # Check if user can request reset
            if not customer.can_request_password_reset():
                log_security_event('PASSWORD_RESET_USER_RATE_LIMITED', f'User: {customer.id}', customer, client_ip)
                # Don't reveal rate limiting to user
            else:
                # Generate secure token
                reset_token = generate_secure_token()
                token_expires = timezone.now() + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES)

                # Clear any existing tokens
                customer.reset_token = reset_token
                customer.reset_token_expires = token_expires
                customer.increment_reset_attempts()
                customer.save(
                    update_fields=['reset_token', 'reset_token_expires', 'reset_attempts', 'reset_attempts_reset_at'])

                # Send email
                email_sent = send_password_reset_email(customer, reset_token, request)

                if email_sent:
                    log_security_event('PASSWORD_RESET_REQUESTED', f'User: {customer.id}', customer, client_ip)
                else:
                    log_security_event('PASSWORD_RESET_EMAIL_FAILED', f'User: {customer.id}', customer, client_ip)

        except Customer.DoesNotExist:
            # Log attempt for non-existent email
            log_security_event('PASSWORD_RESET_NONEXISTENT_EMAIL', f'Email: {email}', ip_address=client_ip)

        except Exception as e:
            logger.error(f"Password reset error for {email}: {str(e)}")
            log_security_event('PASSWORD_RESET_ERROR', f'Email: {email}, Error: {str(e)}', ip_address=client_ip)

        # Always show same message (security)
        messages.success(request, 'اگر ایمیل شما در سیستم موجود باشد، لینک بازیابی ظرف چند دقیقه ارسال خواهد شد.')
        return redirect('forgot_password')

    return render(request, 'auth/forgot_password.html')


@method_decorator(never_cache, name='dispatch')
@ratelimit(key='ip', rate='10/h', method=['GET', 'POST'])
def reset_password_view(request, token):
    """Production password reset view"""

    client_ip = get_client_ip(request)

    # Validate token format
    if not token or len(token) < 20:
        log_security_event('PASSWORD_RESET_INVALID_TOKEN', f'Token: {token[:10]}...', ip_address=client_ip)
        messages.error(request, 'لینک بازیابی نامعتبر است.')
        return redirect('login')

    try:
        customer = Customer.objects.get(
            reset_token=token,
            reset_token_expires__gt=timezone.now(),
            is_active=True
        )
    except Customer.DoesNotExist:
        log_security_event('PASSWORD_RESET_TOKEN_NOT_FOUND', f'Token: {token[:10]}...', ip_address=client_ip)
        messages.error(request, 'لینک بازیابی نامعتبر یا منقضی شده است.')
        return redirect('login')

    # Check account lock status
    if customer.is_account_locked():
        log_security_event('PASSWORD_RESET_ACCOUNT_LOCKED', f'User: {customer.id}', customer, client_ip)
        messages.error(request, 'حساب کاربری شما موقتاً قفل شده است.')
        return redirect('login')

    if request.method == 'POST':
        password = request.POST.get('password', '').strip()
        password_confirm = request.POST.get('password_confirm', '').strip()

        # Comprehensive password validation
        validation_errors = []

        if not password:
            validation_errors.append('رمز عبور الزامی است')
        elif len(password) < 8:
            validation_errors.append('رمز عبور باید حداقل ۸ کاراکتر باشد')
        elif password.isdigit():
            validation_errors.append('رمز عبور نمی‌تواند فقط عدد باشد')
        elif password.lower() in ['password', '12345678', 'qwerty123']:
            validation_errors.append('رمز عبور بسیار ساده است')

        if password != password_confirm:
            validation_errors.append('رمزهای عبور مطابقت ندارند')

        if validation_errors:
            for error in validation_errors:
                messages.error(request, error)
            log_security_event('PASSWORD_RESET_WEAK_PASSWORD', f'User: {customer.id}', customer, client_ip)
            return render(request, 'auth/reset_password.html', {'token': token, 'customer': customer})

        try:
            # Update password
            customer.password = make_password(password)
            customer.reset_token = None
            customer.reset_token_expires = None
            customer.last_password_change = timezone.now()
            customer.failed_login_attempts = 0  # Reset failed attempts
            customer.account_locked_until = None  # Unlock account
            customer.save(update_fields=[
                'password', 'reset_token', 'reset_token_expires',
                'last_password_change', 'failed_login_attempts', 'account_locked_until'
            ])

            # Send confirmation email
            try:
                from django.core.mail import send_mail
                send_mail(
                    'رمز عبور با موفقیت تغییر کرد',
                    f'سلام {customer.name}،\n\nرمز عبور شما با موفقیت تغییر کرد.\n\nزمان تغییر: {timezone.now().strftime("%Y/%m/%d %H:%M")}\n\nاگر این تغییر را شما انجام نداده‌اید، فوراً با پشتیبانی تماس بگیرید.',
                    settings.DEFAULT_FROM_EMAIL,
                    [customer.email],
                    fail_silently=True,
                )
            except:
                pass

            log_security_event('PASSWORD_RESET_SUCCESSFUL', f'User: {customer.id}', customer, client_ip)
            messages.success(request, 'رمز عبور شما با موفقیت تغییر کرد. اکنون می‌توانید وارد شوید.')
            return redirect('login')

        except Exception as e:
            logger.error(f"Error resetting password for user {customer.id}: {str(e)}")
            log_security_event('PASSWORD_RESET_DB_ERROR', f'User: {customer.id}, Error: {str(e)}', customer, client_ip)
            messages.error(request, 'خطا در تغییر رمز عبور. لطفاً مجدداً تلاش کنید.')

    return render(request, 'auth/reset_password.html', {'token': token, 'customer': customer})