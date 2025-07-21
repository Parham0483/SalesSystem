# tasks/services/notification_service.py - Improved version with better error handling

from django.core.mail import EmailMultiAlternatives, send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
from ..models import EmailNotification
import logging
import ssl
from smtplib import SMTP_SSL, SMTPException

logger = logging.getLogger(__name__)


class NotificationService:
    """Handle Persian email notifications for order workflow with improved error handling"""

    @staticmethod
    def send_email_with_tracking(order, email_type, recipient_email, subject, html_content, attachment=None):
        """Send email and track in database with better error handling"""
        notification = EmailNotification.objects.create(
            order=order,
            email_type=email_type,
            recipient_email=recipient_email,
            subject=subject,
            is_successful=False
        )

        try:
            # For development - use simple send_mail for better compatibility
            if settings.DEBUG:
                # Simple text email for development
                plain_text = strip_tags(html_content)
                from django.core.mail import send_mail

                send_mail(
                    subject=subject,
                    message=plain_text,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[recipient_email],
                    fail_silently=False,
                )

                logger.info(
                    f"✅ Simple email sent successfully: {email_type} to {recipient_email} for Order #{order.id}")
            else:
                # Full HTML email for production
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=strip_tags(html_content),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[recipient_email]
                )
                msg.attach_alternative(html_content, "text/html")

                # Add PDF attachment if provided
                if attachment:
                    msg.attach(attachment['filename'], attachment['content'], attachment['mimetype'])

                msg.send()
                logger.info(f"✅ HTML email sent successfully: {email_type} to {recipient_email} for Order #{order.id}")

            notification.is_successful = True
            notification.save()
            return True

        except SMTPException as e:
            error_msg = f"SMTP Error: {str(e)}"
            notification.error_message = error_msg
            notification.save()
            logger.error(f"❌ SMTP Error: {email_type} to {recipient_email} for Order #{order.id} - {error_msg}")
            return False

        except ssl.SSLError as e:
            error_msg = f"SSL Error: {str(e)}"
            notification.error_message = error_msg
            notification.save()
            logger.error(f"❌ SSL Error: {email_type} to {recipient_email} for Order #{order.id} - {error_msg}")
            return False

        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            notification.error_message = error_msg
            notification.save()
            logger.error(f"❌ Email failed: {email_type} to {recipient_email} for Order #{order.id} - {error_msg}")
            return False

    @staticmethod
    def notify_admin_new_order(order):
        """Step 1: Notify admin when customer submits order"""
        try:
            subject = f"سفارش جدید #{order.id} - {order.customer.name}"

            # Simple text message for reliability
            message = f"""
سفارش جدیدی در سیستم ثبت شده است:

شماره سفارش: #{order.id}
نام مشتری: {order.customer.name}
ایمیل مشتری: {order.customer.email}
شرکت: {order.customer.company_name or 'ندارد'}
تاریخ ثبت: {order.created_at.strftime('%Y/%m/%d %H:%M')}
تعداد اقلام: {order.items.count()} محصول

{f'نظر مشتری: {order.customer_comment}' if order.customer_comment else ''}

لطفاً وارد پنل مدیریت شوید و قیمت‌گذاری را انجام دهید.
پنل مدیریت: {settings.FRONTEND_URL}/admin
            """.strip()

            # Send to all admin emails
            admin_emails = getattr(settings, 'ADMIN_EMAIL_LIST', ['admin@company.com'])

            success_count = 0
            for admin_email in admin_emails:
                try:
                    from django.core.mail import send_mail
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[admin_email],
                        fail_silently=False,
                    )

                    # Track in database
                    EmailNotification.objects.create(
                        order=order,
                        email_type='order_submitted',
                        recipient_email=admin_email,
                        subject=subject,
                        is_successful=True
                    )

                    success_count += 1
                    logger.info(f"✅ New order notification sent to admin: {admin_email}")

                except Exception as e:
                    logger.error(f"❌ Failed to send admin notification to {admin_email}: {e}")
                    EmailNotification.objects.create(
                        order=order,
                        email_type='order_submitted',
                        recipient_email=admin_email,
                        subject=subject,
                        is_successful=False,
                        error_message=str(e)
                    )

            logger.info(f"📧 Step 1: New order notification sent to {success_count}/{len(admin_emails)} admins")
            return success_count > 0

        except Exception as e:
            logger.error(f"❌ Failed to send new order notification: {e}")
            return False

    @staticmethod
    def notify_customer_pricing_ready(order):
        """Step 2: Notify customer when admin completes pricing"""
        try:
            subject = f"قیمت‌گذاری سفارش #{order.id} آماده است"

            message = f"""
{order.customer.name} عزیز،

قیمت‌گذاری سفارش شماره #{order.id} توسط تیم ما انجام شده و آماده بررسی شماست.

مبلغ کل سفارش: {order.quoted_total:,.0f} ریال

مراحل بعدی:
1. وارد پنل کاربری خود شوید
2. جزئیات قیمت‌گذاری را بررسی کنید  
3. سفارش را تأیید یا رد کنید

⚠️ لطفاً ظرف مدت ۴۸ ساعت نسبت به تأیید یا رد سفارش اقدام کنید.

لینک پنل کاربری: {settings.FRONTEND_URL}/dashboard

در صورت داشتن سؤال، با تیم پشتیبانی تماس بگیرید.
با تشکر از اعتماد شما
            """.strip()

            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[order.customer.email],
                fail_silently=False,
            )

            # Track success
            EmailNotification.objects.create(
                order=order,
                email_type='pricing_ready',
                recipient_email=order.customer.email,
                subject=subject,
                is_successful=True
            )

            logger.info(f"📧 Step 2: Pricing ready notification sent to {order.customer.email}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to send pricing ready notification: {e}")
            # Track failure
            EmailNotification.objects.create(
                order=order,
                email_type='pricing_ready',
                recipient_email=order.customer.email,
                subject=subject if 'subject' in locals() else f"قیمت‌گذاری سفارش #{order.id}",
                is_successful=False,
                error_message=str(e)
            )
            return False

    @staticmethod
    def notify_customer_order_confirmed(order, include_pdf=True):
        """Step 3a: Notify customer when they confirm order"""
        try:
            subject = f"سفارش #{order.id} تأیید شد"

            message = f"""
{order.customer.name} عزیز،

سفارش شماره #{order.id} با موفقیت تأیید شد!

مبلغ نهایی: {order.quoted_total:,.0f} ریال

سفارش شما با موفقیت تأیید شد و در حال پردازش است.

مراحل بعدی:
1. پردازش و آماده‌سازی سفارش شما آغاز شده است
2. در صورت نیاز به هماهنگی، با شما تماس خواهیم گرفت
3. زمان تحویل از طریق پیامک اطلاع‌رسانی خواهد شد

از اعتماد شما سپاسگزاریم.
تیم فروش
            """.strip()

            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[order.customer.email],
                fail_silently=False,
            )

            # Track success
            EmailNotification.objects.create(
                order=order,
                email_type='order_confirmed',
                recipient_email=order.customer.email,
                subject=subject,
                is_successful=True
            )

            logger.info(f"📧 Step 3a: Order confirmed notification sent to {order.customer.email}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to send order confirmed notification: {e}")
            # Track failure
            EmailNotification.objects.create(
                order=order,
                email_type='order_confirmed',
                recipient_email=order.customer.email,
                subject=subject if 'subject' in locals() else f"سفارش #{order.id} تأیید شد",
                is_successful=False,
                error_message=str(e)
            )
            return False

    @staticmethod
    def notify_customer_order_rejected(order, rejection_reason):
        """Step 3b: Notify customer when they reject order"""
        try:
            subject = f"سفارش #{order.id} رد شد"

            message = f"""
{order.customer.name} عزیز،

متأسفانه سفارش شماره #{order.id} توسط شما رد شده است.

دلیل رد سفارش:
{rejection_reason}

📞 نیاز به مشاوره دارید؟
تیم فروش ما آماده پاسخگویی و ارائه راهکارهای مناسب‌تر است.

ایمیل پشتیبانی: {settings.SUPPORT_EMAIL}

ما همچنان منتظر همکاری دوباره با شما هستیم.

با احترام،
تیم فروش
            """.strip()

            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[order.customer.email],
                fail_silently=False,
            )

            # Track success
            EmailNotification.objects.create(
                order=order,
                email_type='order_rejected',
                recipient_email=order.customer.email,
                subject=subject,
                is_successful=True
            )

            logger.info(f"📧 Step 3b: Order rejected notification sent to {order.customer.email}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to send order rejected notification: {e}")
            # Track failure
            EmailNotification.objects.create(
                order=order,
                email_type='order_rejected',
                recipient_email=order.customer.email,
                subject=subject if 'subject' in locals() else f"سفارش #{order.id} رد شد",
                is_successful=False,
                error_message=str(e)
            )
            return False

    @staticmethod
    def notify_admin_order_status_change(order, new_status, user=None):
        """Notify admin about order status changes"""
        try:
            status_messages = {
                'confirmed': 'تأیید شد',
                'rejected': 'رد شد',
                'completed': 'تکمیل شد',
                'cancelled': 'لغو شد'
            }

            status_text = status_messages.get(new_status, new_status)
            subject = f"سفارش #{order.id} {status_text}"

            message = f"""
تغییر وضعیت سفارش:

شماره سفارش: #{order.id}
مشتری: {order.customer.name}
وضعیت جدید: {status_text}
تغییر توسط: {user.name if user else 'سیستم'}
زمان تغییر: {order.updated_at.strftime('%Y/%m/%d %H:%M')}

پنل مدیریت: {settings.FRONTEND_URL}/admin
            """.strip()

            admin_emails = getattr(settings, 'ADMIN_EMAIL_LIST', ['admin@company.com'])

            success_count = 0
            for admin_email in admin_emails:
                try:
                    from django.core.mail import send_mail
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[admin_email],
                        fail_silently=False,
                    )
                    success_count += 1
                    logger.info(f"✅ Status change notification sent to admin: {admin_email}")
                except Exception as e:
                    logger.error(f"❌ Failed to send admin notification to {admin_email}: {e}")

            return success_count > 0

        except Exception as e:
            logger.error(f"❌ Failed to send admin status change notification: {e}")
            return False

    @staticmethod
    def test_email_configuration():
        """Test email configuration - useful for debugging"""
        try:
            from django.core.mail import send_mail
            send_mail(
                subject='Test Email - Django Configuration',
                message='This is a test email to verify email configuration.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.DEFAULT_FROM_EMAIL],  # Send to yourself
                fail_silently=False,
            )
            logger.info("✅ Test email sent successfully!")
            return True
        except Exception as e:
            logger.error(f"❌ Test email failed: {e}")
            return False