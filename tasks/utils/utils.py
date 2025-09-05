import secrets
import hashlib
import hmac
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from datetime import timedelta
import logging

logger = logging.getLogger('password_reset')
security_logger = logging.getLogger('security')


def generate_secure_token():
    """Generate cryptographically secure token"""
    return secrets.token_urlsafe(32)


def create_signed_token(user_id, token):
    """Create HMAC signed token for additional security"""
    message = f"{user_id}:{token}:{timezone.now().timestamp()}"
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{token}.{signature}"


def verify_signed_token(user_id, signed_token):
    """Verify HMAC signed token"""
    try:
        token, signature = signed_token.rsplit('.', 1)
        message = f"{user_id}:{token}:{timezone.now().timestamp()}"
        expected_signature = hmac.new(
            settings.SECRET_KEY.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_signature), token
    except ValueError:
        return False, None


def check_rate_limit(key, max_attempts=5, window=3600):
    """Redis-based rate limiting"""
    current_time = timezone.now().timestamp()
    window_start = current_time - window

    # Clean old attempts
    cache.delete_many([f"{key}:{int(t)}" for t in range(int(window_start), int(current_time))])

    # Count current attempts
    attempts = []
    for i in range(window):
        attempt_key = f"{key}:{int(current_time - i)}"
        if cache.get(attempt_key):
            attempts.append(attempt_key)

    if len(attempts) >= max_attempts:
        return False, max_attempts - len(attempts)

    # Record this attempt
    cache.set(f"{key}:{int(current_time)}", 1, timeout=window)
    return True, max_attempts - len(attempts) - 1


def get_client_ip(request):
    """Get real client IP behind proxies"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def send_password_reset_email(customer, reset_token, request):
    """Send production-quality password reset email"""
    try:
        reset_url = request.build_absolute_uri(f'/auth/reset-password/{reset_token}/')

        # Render HTML and text versions
        context = {
            'customer': customer,
            'reset_url': reset_url,
            'site_name': 'Your Site Name',
            'expiry_minutes': settings.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES,
        }

        html_content = render_to_string('emails/password_reset.html', context)
        text_content = render_to_string('emails/password_reset.txt', context)

        msg = EmailMultiAlternatives(
            subject='بازیابی رمز عبور - Your Site',
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[customer.email]
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()

        logger.info(f"Password reset email sent to {customer.email}")
        return True

    except Exception as e:
        logger.error(f"Failed to send password reset email to {customer.email}: {str(e)}")
        return False


def log_security_event(event_type, details, user=None, ip_address=None):
    """Log security events for monitoring"""
    log_data = {
        'event': event_type,
        'details': details,
        'ip': ip_address,
        'timestamp': timezone.now().isoformat(),
    }

    if user:
        log_data['user_id'] = user.id
        log_data['user_email'] = user.email

    security_logger.warning(f"SECURITY_EVENT: {log_data}")


