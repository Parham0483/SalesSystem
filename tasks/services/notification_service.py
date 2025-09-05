from django.core.mail import EmailMultiAlternatives, send_mail, get_connection
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
from ..models import EmailNotification, Customer, SMSNotification
import logging
import ssl
from smtplib import SMTP_SSL, SMTPException

logger = logging.getLogger(__name__)


class NotificationService:
    """Enhanced Persian email + SMS notifications"""

    @staticmethod
    def send_email_with_tracking(order=None, email_type=None, recipient_email=None, subject=None, html_content=None,
                                 attachment=None, announcement=None, dealer=None):
        """Enhanced send email method with OAuth2 support and automatic fallback"""

        notification = EmailNotification.objects.create(
            order=order,
            email_type=email_type,
            recipient_email=recipient_email,
            subject=subject,
            is_successful=False,
            announcement=announcement,
            dealer=dealer
        )

        try:
            # Try OAuth2 first if configured
            if hasattr(settings, 'EMAIL_BACKEND') and 'oauth2' in settings.EMAIL_BACKEND.lower():
                logger.info("🔐 Attempting OAuth2 email send")
                try:
                    # Use OAuth2 backend
                    connection = get_connection(backend=settings.EMAIL_BACKEND)

                    if html_content:
                        # HTML email with OAuth2
                        plain_text = strip_tags(html_content)
                        msg = EmailMultiAlternatives(
                            subject=subject,
                            body=plain_text,
                            from_email=settings.DEFAULT_FROM_EMAIL,
                            to=[recipient_email],
                            connection=connection
                        )
                        msg.attach_alternative(html_content, "text/html")

                        # Add PDF attachment if provided
                        if attachment:
                            msg.attach(attachment['filename'], attachment['content'], attachment['mimetype'])

                        msg.send()
                    else:
                        # Plain text email with OAuth2
                        send_mail(
                            subject=subject,
                            message=strip_tags(html_content) if html_content else "Email content",
                            from_email=settings.DEFAULT_FROM_EMAIL,
                            recipient_list=[recipient_email],
                            connection=connection,
                            fail_silently=False,
                        )

                    notification.is_successful = True
                    notification.save()
                    logger.info(f"✅ OAuth2 email sent successfully: {email_type} to {recipient_email}")
                    return True

                except Exception as oauth_error:
                    logger.warning(f"⚠️ OAuth2 failed: {oauth_error}, trying SMTP fallback")
                    # Fall through to SMTP fallback below

            # SMTP Fallback (your original logic)
            logger.info("📧 Using SMTP fallback")

            if settings.DEBUG:
                # Simple text email for development
                plain_text = strip_tags(html_content) if html_content else "Email content"

                send_mail(
                    subject=subject,
                    message=plain_text,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[recipient_email],
                    fail_silently=False,
                )
                logger.info(f"✅ Simple email sent successfully: {email_type} to {recipient_email}")
            else:
                # Full HTML email for production
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=strip_tags(html_content) if html_content else "Email content",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[recipient_email]
                )

                if html_content:
                    msg.attach_alternative(html_content, "text/html")

                # Add PDF attachment if provided
                if attachment:
                    msg.attach(attachment['filename'], attachment['content'], attachment['mimetype'])

                msg.send()
                logger.info(f"✅ HTML email sent successfully: {email_type} to {recipient_email}")

            notification.is_successful = True
            notification.save()
            return True

        except Exception as e:
            error_msg = f"Email Error: {str(e)}"
            notification.error_message = error_msg
            notification.save()
            logger.error(f"❌ Email failed: {email_type} to {recipient_email} - {error_msg}")
            return False

    @staticmethod
    def send_sms_notification(phone, message, order=None, sms_type='general', announcement=None, dealer=None):

        # Check if SMS is enabled
        if not getattr(settings, 'SMS_NOTIFICATIONS_ENABLED', False):
            logger.info("📱 SMS notifications are disabled")
            return False

        try:
            from .sms_service import KavenegarSMSService

            # Initialize SMS service
            sms_service = KavenegarSMSService()

            # Clean phone number for Iranian format
            clean_phone = sms_service.clean_iranian_phone(phone)

            if not clean_phone:
                logger.error(f"❌ Invalid phone number: '{phone}' -> could not clean")
                return False

            logger.info(f"📱 SMS: {phone} -> {clean_phone}")

            if sms_service.is_duplicate_sms(clean_phone, message, sms_type):
                logger.warning(f"⚠️ Duplicate SMS prevented for {clean_phone} - {sms_type}")
                return True  # Return True because technically it "succeeded" (already sent)

            # Send SMS
            result = sms_service.send_sms(
                receptor=clean_phone,
                message=message,
                order=order,
                sms_type=sms_type,
                announcement=announcement,
                dealer=dealer
            )

            if result.get('success'):
                logger.info(f"✅ SMS sent successfully to {clean_phone}")
                return True
            else:
                logger.error(f"❌ SMS failed to {clean_phone}: {result.get('error', 'Unknown error')}")
                return False

        except ImportError:
            logger.warning("⚠️ SMS service not available - kavenegar package not installed")
            return False
        except Exception as e:
            logger.error(f"❌ SMS service error: {str(e)}")
            return False

    @staticmethod
    def send_dual_notification(order, notification_type, custom_sms_message=None, custom_email_data=None):
        """
        Send both email and SMS notification for an order

        Args:
            order: Order object
            notification_type: Type of notification ('order_submitted', 'pricing_ready', etc.)
            custom_sms_message: Custom SMS message (optional)
            custom_email_data: Custom email data (optional)

        Returns:
            dict: Results of both email and SMS sending
        """
        results = {
            'email': {'sent': False, 'error': None},
            'sms': {'sent': False, 'error': None}
        }

        # Send Email Notification
        try:
            email_sent = False

            if notification_type == 'order_submitted':
                email_sent = NotificationService.notify_admin_new_order(order)

                # Also send SMS to customer
                if order.customer.phone:
                    sms_message = custom_sms_message or f"""سلام {order.customer.name}
سفارش #{order.id} با موفقیت ثبت شد.
منتظر قیمت‌گذاری باشید.
کیان تجارت پویا کویر"""

                    sms_sent = NotificationService.send_sms_notification(
                        phone=order.customer.phone,
                        message=sms_message,
                        order=order,
                        sms_type=notification_type
                    )
                    results['sms']['sent'] = sms_sent

            elif notification_type == 'pricing_ready':
                email_sent = NotificationService.notify_customer_pricing_ready(order)

                # Send SMS to customer
                if order.customer.phone:
                    sms_message = custom_sms_message or f"""سلام {order.customer.name}
قیمت سفارش #{order.id} آماده است.
مبلغ: {order.quoted_total:,.0f} ریال
لطفا وارد سایت شوید.
کیان تجارت پویا کویر"""

                    sms_sent = NotificationService.send_sms_notification(
                        phone=order.customer.phone,
                        message=sms_message,
                        order=order,
                        sms_type=notification_type
                    )
                    results['sms']['sent'] = sms_sent

            elif notification_type == 'order_confirmed':
                email_sent = NotificationService.notify_customer_order_confirmed(order, include_pdf=True)

                # Send SMS to customer
                if order.customer.phone:
                    sms_message = custom_sms_message or f"""سلام {order.customer.name}
سفارش #{order.id} تایید شد!
مبلغ: {order.quoted_total:,.0f} ریال
در حال آماده‌سازی است.
کیان تجارت پویا کویر"""

                    sms_sent = NotificationService.send_sms_notification(
                        phone=order.customer.phone,
                        message=sms_message,
                        order=order,
                        sms_type=notification_type
                    )
                    results['sms']['sent'] = sms_sent

            elif notification_type == 'order_rejected':
                email_sent = NotificationService.notify_customer_order_rejected(
                    order, order.customer_rejection_reason or 'No reason provided'
                )

                # Send SMS to customer
                if order.customer.phone:
                    sms_message = custom_sms_message or f"""سلام {order.customer.name}
متاسفانه سفارش #{order.id} لغو شد.
برای اطلاعات بیشتر تماس بگیرید.
کیان تجارت پویا کویر"""

                    sms_sent = NotificationService.send_sms_notification(
                        phone=order.customer.phone,
                        message=sms_message,
                        order=order,
                        sms_type=notification_type
                    )
                    results['sms']['sent'] = sms_sent

            elif notification_type == 'dealer_assigned':
                # This would be handled separately by notify_dealer_assignment
                email_sent = True  # Assume handled elsewhere

            results['email']['sent'] = email_sent

        except Exception as e:
            results['email']['error'] = str(e)
            logger.error(f"❌ Dual notification email failed: {str(e)}")

        return results

    @staticmethod
    def notify_admin_new_order(order):
        try:
            subject = f"سفارش جدید #{order.id} - {order.customer.name}"

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

            admin_emails = getattr(settings, 'ADMIN_EMAIL_LIST', ['admin@company.com'])

            success_count = 0
            for admin_email in admin_emails:
                try:
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[admin_email],
                        fail_silently=False,
                    )

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


            logger.info(f"📧 Admin email notification sent to {success_count}/{len(admin_emails)} admins")
            return success_count > 0

        except Exception as e:
            logger.error(f"❌ Failed to send new order notification: {e}")
            return False

    @staticmethod
    def notify_customer_pricing_ready(order):
        """Step 2: Notify customer when admin completes pricing + SMS"""
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

⚠️ لطفاً ظرف مدت امروز ساعت نسبت به تأیید یا رد سفارش اقدام کنید.

لینک پنل کاربری: {settings.FRONTEND_URL}/dashboard

در صورت داشتن سؤال، با تیم پشتیبانی تماس بگیرید.
با تشکر از اعتماد شما
            """.strip()

            # Send email
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[order.customer.email],
                fail_silently=False,
            )

            EmailNotification.objects.create(
                order=order,
                email_type='pricing_ready',
                recipient_email=order.customer.email,
                subject=subject,
                is_successful=True
            )

            # NEW: Send SMS notification
            if order.customer.phone:
                sms_message = f"""سلام {order.customer.name}
قیمت سفارش #{order.id} آماده است.
مبلغ: {order.quoted_total:,.0f} ریال
لطفا وارد سایت شوید.
کیان تجارت پویا کویر"""

                NotificationService.send_sms_notification(
                    phone=order.customer.phone,
                    message=sms_message,
                    order=order,
                    sms_type='pricing_ready'
                )

            logger.info(f"📧 Step 2: Pricing ready notification sent to {order.customer.email}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to send pricing ready notification: {e}")
            EmailNotification.objects.create(
                order=order,
                email_type='pricing_ready',
                recipient_email=order.customer.email,
                subject= subject if 'subject' in locals() else f"قیمت‌گذاری سفارش #{order.id}",
                is_successful=False,
                error_message=str(e)
            )
            return False

    @staticmethod
    def notify_customer_order_confirmed(order, include_pdf=True):
        """Step 3a: Notify customer when they confirm order + SMS"""
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

            # Send email
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[order.customer.email],
                fail_silently=False,
            )

            EmailNotification.objects.create(
                order=order,
                email_type='order_confirmed',
                recipient_email=order.customer.email,
                subject=subject,
                is_successful=True
            )

            # NEW: Send SMS notification
            if order.customer.phone:
                sms_message = f"""سلام {order.customer.name}
سفارش #{order.id} تایید شد!
مبلغ: {order.quoted_total:,.0f} ریال
در حال آماده‌سازی است.
کیان تجارت پویا کویر"""

                NotificationService.send_sms_notification(
                    phone=order.customer.phone,
                    message=sms_message,
                    order=order,
                    sms_type='order_confirmed'
                )

            logger.info(f"📧 Step 3a: Order confirmed notification sent to {order.customer.email}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to send order confirmed notification: {e}")
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
        """Step 3b: Notify customer when they reject order + SMS"""
        try:
            subject = f"سفارش #{order.id} رد شد"

            message = f"""
{order.customer.name} عزیز،

متأسفانه سفارش شماره #{order.id} توسط شما رد شده است.

دلیل رد سفارش:
{rejection_reason}

📞 نیاز به مشاوره دارید؟
تیم فروش ما آماده پاسخگویی و ارائه راهکارهای مناسب‌تر است.

ایمیل پشتیبانی: {getattr(settings, 'SUPPORT_EMAIL', 'support@company.com')}

ما همچنان منتظر همکاری دوباره با شما هستیم.

با احترام،
تیم فروش
            """.strip()

            # Send email
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[order.customer.email],
                fail_silently=False,
            )

            EmailNotification.objects.create(
                order=order,
                email_type='order_rejected',
                recipient_email=order.customer.email,
                subject=subject,
                is_successful=True
            )

            # NEW: Send SMS notification
            if order.customer.phone:
                sms_message = f"""سلام {order.customer.name}
متاسفانه سفارش #{order.id} لغو شد.
برای اطلاعات بیشتر تماس بگیرید.
کیان تجارت پویا کویر"""

                NotificationService.send_sms_notification(
                    phone=order.customer.phone,
                    message=sms_message,
                    order=order,
                    sms_type='order_rejected'
                )

            logger.info(f"📧 Step 3b: Order rejected notification sent to {order.customer.email}")
            return True

        except Exception as e:
            logger.error(f"❌ Failed to send order rejected notification: {e}")
            EmailNotification.objects.create(
                order=order,
                email_type='order_rejected',
                recipient_email=order.customer.email,
                subject=subject if 'subject' in locals() else f"سفارش #{order.id} رد شد",
                is_successful=False,
                error_message=str(e)
            )
            return False

    # ========== EXISTING METHODS (keeping all your existing methods) ==========

    @staticmethod
    def safe_date_format(date_field):
        """Safely format date field that might be string or date object"""
        if not date_field:
            return ""

        if hasattr(date_field, 'strftime'):
            return date_field.strftime("%Y/%m/%d")
        else:
            return str(date_field)

    @staticmethod
    def notify_all_customers_new_arrival(announcement):
        """UPDATED: Notify all active customers about new arrival announcement + SMS"""
        try:
            # Get all active customers (excluding staff)
            customers = Customer.objects.filter(
                is_active=True,
                is_staff=False
            )

            subject = f"🚢 محموله جدید رسید - {announcement.title}"

            success_count = 0
            sms_sent_count = 0
            total_customers = customers.count()

            logger.info(f"📧 Starting new arrival notification to {total_customers} customers")

            for customer in customers:
                try:
                    # Create personalized message with SAFE date formatting
                    message = f"""
    {customer.name} عزیز،

    محموله جدیدی به انبار ما رسیده است!

    📦 عنوان محموله: {announcement.title}

    📝 توضیحات:
    {announcement.description}

    {f'🌍 مبدا: {announcement.origin_country}' if announcement.origin_country else ''}

    {f'📅 تاریخ ارسال: {NotificationService.safe_date_format(announcement.shipment_date)}' if announcement.shipment_date else ''}

    {f'🚚 تاریخ تخمینی رسیدن: {NotificationService.safe_date_format(announcement.estimated_arrival)}' if announcement.estimated_arrival else ''}

    {f'📋 دسته‌بندی محصولات: {announcement.product_categories}' if announcement.product_categories else ''}

    🔗 برای مشاهده جزئیات و سفارش، وارد سایت شوید:
    {settings.FRONTEND_URL}/announcements/{announcement.id}

    با تشکر،
    تیم فروش کیان تجارت پویا کویر
                    """.strip()

                    # Send email
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[customer.email],
                        fail_silently=False,
                    )

                    # Track email notification
                    EmailNotification.objects.create(
                        order=None,
                        email_type='new_arrival_customer',
                        recipient_email=customer.email,
                        subject=subject,
                        is_successful=True,
                        announcement=announcement
                    )

                    success_count += 1

                    # NEW: Send SMS if customer has phone
                    if customer.phone:
                        sms_message = f"""سلام {customer.name}
محموله جدید "{announcement.title}" رسید!
برای مشاهده وارد سایت شوید.
کیان تجارت پویا کویر"""

                        sms_sent = NotificationService.send_sms_notification(
                            phone=customer.phone,
                            message=sms_message,
                            announcement=announcement,
                            sms_type='new_arrival_customer'
                        )

                        if sms_sent:
                            sms_sent_count += 1

                except Exception as e:
                    logger.error(f"❌ Failed to send new arrival notification to {customer.email}: {e}")
                    # Track failed email notification
                    EmailNotification.objects.create(
                        order=None,
                        email_type='new_arrival_customer',
                        recipient_email=customer.email,
                        subject=subject,
                        is_successful=False,
                        error_message=str(e),
                        announcement=announcement
                    )

            logger.info(f"📧 New arrival notification sent to {success_count}/{total_customers} customers")
            logger.info(f"📱 SMS sent to {sms_sent_count} customers")
            return success_count

        except Exception as e:
            logger.error(f"❌ Failed to send new arrival notifications: {e}")
            return 0

    @staticmethod
    def notify_dealers_new_arrival(announcement):
        try:
            # Get all active dealers
            dealers = Customer.objects.filter(
                is_active=True,
                is_dealer=True
            )

            if not dealers.exists():
                logger.info("No active dealers found for new arrival notification")
                return 0

            subject = f"💼 فرصت فروش جدید - {announcement.title}"

            success_count = 0
            total_dealers = dealers.count()

            logger.info(f"📧 Starting new arrival notification to {total_dealers} dealers")

            for dealer in dealers:
                try:
                    # Create dealer-specific message with SAFE date formatting
                    message = f"""
    {dealer.name} عزیز (نماینده محترم),

    محموله جدیدی با فرصت‌های فروش عالی به انبار ما رسیده است!

    📦 عنوان محموله: {announcement.title}

    📝 توضیحات:
    {announcement.description}

    💰 اطلاعات کمیسیون شما:
    - نرخ کمیسیون: {dealer.dealer_commission_rate}%
    - کد نماینده: {dealer.dealer_code}

    {f'🌍 مبدا: {announcement.origin_country}' if announcement.origin_country else ''}

    {f'📅 تاریخ ارسال: {NotificationService.safe_date_format(announcement.shipment_date)}' if announcement.shipment_date else ''}

    {f'🚚 تاریخ تخمینی رسیدن: {NotificationService.safe_date_format(announcement.estimated_arrival)}' if announcement.estimated_arrival else ''}

    {f'📋 دسته‌بندی محصولات: {announcement.product_categories}' if announcement.product_categories else ''}

    💡 راهکارهای فروش:
    - با مشتریان خود در میان بگذارید
    - فرصت‌های فروش جدید را شناسایی کنید
    - برای کسب کمیسیون بهتر، سفارشات را پیگیری کنید

    🔗 لینک مشاهده محموله:
    {settings.FRONTEND_URL}/announcements/{announcement.id}

    🔗 پنل نماینده شما:
    {settings.FRONTEND_URL}/dealer-dashboard

    موفق باشید!
    مدیریت کیان تجارت پویا کویر
                    """.strip()

                    from django.core.mail import send_mail
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[dealer.email],
                        fail_silently=False,
                    )

                    EmailNotification.objects.create(
                        order=None,
                        email_type='new_arrival_dealer',
                        recipient_email=dealer.email,
                        subject=subject,
                        is_successful=True,
                        announcement=announcement,
                        dealer=dealer
                    )

                    success_count += 1

                except Exception as e:
                    logger.error(f"❌ Failed to send new arrival notification to dealer {dealer.email}: {e}")
                    EmailNotification.objects.create(
                        order=None,
                        email_type='new_arrival_dealer',
                        recipient_email=dealer.email,
                        subject=subject,
                        is_successful=False,
                        error_message=str(e),
                        announcement=announcement,
                        dealer=dealer
                    )

            logger.info(f"📧 New arrival notification sent to {success_count}/{total_dealers} dealers")
            return success_count

        except Exception as e:
            logger.error(f"❌ Failed to send new arrival notifications to dealers: {e}")
            return 0

    @staticmethod
    def notify_dealer_assignment(order, dealer, custom_commission_rate=None):
        """NEW: Notify dealer when they are assigned to an order"""
        try:
            effective_rate = custom_commission_rate or dealer.dealer_commission_rate

            subject = f"🎯 سفارش جدید #{order.id} به شما تخصیص داده شد"

            message = f"""
{dealer.name} عزیز،

سفارش جدیدی به شما تخصیص داده شده است!

📋 جزئیات سفارش:
- شماره سفارش: #{order.id}
- مشتری: {order.customer.name}
- شرکت مشتری: {order.customer.company_name or 'ندارد'}
- تاریخ سفارش: {order.created_at.strftime('%Y/%m/%d %H:%M')}
- وضعیت فعلی: {order.get_status_display()}

💰 اطلاعات کمیسیون:
- نرخ کمیسیون: {effective_rate}%
{f'- نرخ سفارشی (برای این سفارش): بله' if custom_commission_rate else '- نرخ پیش‌فرض شما'}

{f'💬 نظر مشتری: {order.customer_comment}' if order.customer_comment else ''}

📞 اطلاعات تماس مشتری:
- ایمیل: {order.customer.email}
- تلفن: {order.customer.phone or 'ثبت نشده'}

📦 اقلام سفارش: {order.items.count()} محصول

🔗 برای مشاهده جزئیات کامل و مدیریت سفارش:
{settings.FRONTEND_URL}/dealer/orders/{order.id}

🔗 پنل نماینده شما:
{settings.FRONTEND_URL}/dealer-dashboard

نکات مهم:
- لطفاً در اسرع وقت با مشتری تماس بگیرید
- در صورت نیاز، یادداشت‌های خود را در سیستم ثبت کنید
- پیگیری مناسب = کمیسیون بهتر

موفق باشید!
مدیریت کیان تجارت پویا کویر
            """.strip()

            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[dealer.email],
                fail_silently=False,
            )

            # Track notification
            EmailNotification.objects.create(
                order=order,
                email_type='dealer_assigned',
                recipient_email=dealer.email,
                subject=subject,
                is_successful=True,
                dealer=dealer
            )

            return True

        except Exception as e:
            logger.error(f"❌ Failed to send dealer assignment notification: {e}")
            # Track failed notification
            EmailNotification.objects.create(
                order=order,
                email_type='dealer_assigned',
                recipient_email=dealer.email,
                subject=subject if 'subject' in locals() else f"تخصیص سفارش #{order.id}",
                is_successful=False,
                error_message=str(e),
                dealer=dealer
            )
            return False

    @staticmethod
    def notify_dealer_removal(order, dealer, removed_by, reason=""):
        """NEW: Notify dealer when they are removed from an order"""
        try:
            subject = f"❌ سفارش #{order.id} از شما حذف شد"

            message = f"""
{dealer.name} عزیز،

متأسفانه سفارش شماره #{order.id} از لیست سفارشات شما حذف شده است.

📋 جزئیات سفارش:
- شماره سفارش: #{order.id}
- مشتری: {order.customer.name}
- حذف شده توسط: {removed_by.name}
- تاریخ حذف: {order.updated_at.strftime('%Y/%m/%d %H:%M')}

{f'دلیل حذف: {reason}' if reason else ''}

❗ نکات مهم:
- دیگر مسئولیتی نسبت به این سفارش ندارید
- کمیسیون این سفارش محاسبه نخواهد شد
- سفارشات فعلی شما تحت تأثیر قرار نمی‌گیرند

🔗 پنل نماینده شما:
{settings.FRONTEND_URL}/dealer-dashboard

در صورت سؤال، با مدیریت تماس بگیرید.

با احترام،
مدیریت کیان تجارت پویا کویر
            """.strip()

            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[dealer.email],
                fail_silently=False,
            )

            # Track notification
            EmailNotification.objects.create(
                order=order,
                email_type='dealer_removed',
                recipient_email=dealer.email,
                subject=subject,
                is_successful=True,
                dealer=dealer
            )

            return True

        except Exception as e:
            logger.error(f"❌ Failed to send dealer removal notification: {e}")
            return False

    def notify_dealer_commission_paid(dealer, commissions_list, payment_reference=""):
        try:
            total_amount = sum(commission.commission_amount for commission in commissions_list)
            total_orders = len(commissions_list)

            subject = f"💰 کمیسیون شما پرداخت شد - {total_amount:,.0f} ریال"

            # Create commission details
            commission_details = ""
            for commission in commissions_list:
                commission_details += f"- سفارش #{commission.order.id}: {commission.commission_amount:,.0f} ریال ({commission.commission_rate}%)\n"

            message = f"""
    {dealer.name} عزیز،

    کمیسیون شما با موفقیت پرداخت شد! 🎉

    💰 خلاصه پرداخت:
    - مبلغ کل پرداختی: {total_amount:,.0f} ریال
    - تعداد سفارشات: {total_orders} سفارش
    - کد نماینده: {dealer.dealer_code}
    {f'- شماره پیگیری: {payment_reference}' if payment_reference else ''}
    - تاریخ پرداخت: {commissions_list[0].paid_at.strftime('%Y/%m/%d %H:%M') if commissions_list[0].paid_at else 'نامشخص'}

    📋 جزئیات کمیسیون‌ها:
    {commission_details}

    📊 آمار عملکرد شما:
    - نرخ کمیسیون فعلی: {dealer.dealer_commission_rate}%
    - کل سفارشات تخصیص یافته: {dealer.assigned_orders.count()}
    - سفارشات تکمیل شده: {dealer.assigned_orders.filter(status='completed').count()}

    💡 نکات مهم:
    - این مبلغ به حساب شما واریز شده است
    - فاکتور پرداخت در پنل شما قابل مشاهده است
    - برای کسب کمیسیون بیشتر، فعالیت خود را ادامه دهید

    🔗 پنل نماینده شما:
    {settings.FRONTEND_URL}/dealer-dashboard

    🔗 گزارش کمیسیون‌ها:
    {settings.FRONTEND_URL}/dealer/commissions

    بابت همکاری‌تان متشکریم!
    مدیریت کیان تجارت پویا کویر

    📞 در صورت سؤال: {getattr(settings, 'SUPPORT_EMAIL', 'support@company.com')}
            """.strip()

            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[dealer.email],
                fail_silently=False,
            )

            EmailNotification.objects.create(
                order=None,
                email_type='commission_paid',
                recipient_email=dealer.email,
                subject=subject,
                is_successful=True,
                dealer=dealer
            )

            return True

        except Exception as e:
            logger.error(f"❌ Failed to send commission payment notification: {e}")
            EmailNotification.objects.create(
                order=None,
                email_type='commission_paid',
                recipient_email=dealer.email,
                subject=subject if 'subject' in locals() else "پرداخت کمیسیون",
                is_successful=False,
                error_message=str(e),
                dealer=dealer
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
    def notify_admin_payment_uploaded(order):
        """Notify admin when customer uploads payment receipt"""
        try:
            subject = f"رسید پرداخت آپلود شد - سفارش #{order.id}"

            # Safe timestamp handling
            upload_time = "نامشخص"
            if order.payment_receipt_uploaded_at:
                upload_time = order.payment_receipt_uploaded_at.strftime('%Y/%m/%d %H:%M')
            else:
                # Fallback to current time
                from django.utils import timezone
                upload_time = timezone.now().strftime('%Y/%m/%d %H:%M')

            message = f"""
    رسید پرداخت برای سفارش جدیدی آپلود شده است:

    شماره سفارش: #{order.id}
    نام مشتری: {order.customer.name}
    مبلغ سفارش: {order.quoted_total:,.0f} ریال
    تاریخ آپلود: {upload_time}

    لطفاً وارد پنل مدیریت شوید و رسید پرداخت را بررسی کنید.
    پنل مدیریت: {settings.FRONTEND_URL}/admin/orders/{order.id}
            """.strip()

            admin_emails = getattr(settings, 'ADMIN_EMAIL_LIST', ['admin@company.com'])

            success_count = 0
            for admin_email in admin_emails:
                try:
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[admin_email],
                        fail_silently=False,
                    )
                    success_count += 1
                    logger.info(f"✅ Payment upload notification sent to admin: {admin_email}")
                except Exception as e:
                    logger.error(f"❌ Failed to send payment upload notification to {admin_email}: {e}")

            return success_count > 0

        except Exception as e:
            logger.error(f"❌ Failed to send payment upload notification: {e}")
            return False

    @staticmethod
    def notify_admin_payment_uploaded(order):
        """Notify admin when customer uploads payment receipt"""
        try:
            subject = f"رسید پرداخت آپلود شد - سفارش #{order.id}"

            # Safe timestamp handling
            upload_time = "نامشخص"
            if order.payment_receipt_uploaded_at:
                upload_time = order.payment_receipt_uploaded_at.strftime('%Y/%m/%d %H:%M')
            else:
                # Fallback to current time
                from django.utils import timezone
                upload_time = timezone.now().strftime('%Y/%m/%d %H:%M')

            message = f"""
    رسید پرداخت برای سفارش جدیدی آپلود شده است:

    شماره سفارش: #{order.id}
    نام مشتری: {order.customer.name}
    مبلغ سفارش: {order.quoted_total:,.0f} ریال
    تاریخ آپلود: {upload_time}

    لطفاً وارد پنل مدیریت شوید و رسید پرداخت را بررسی کنید.
    پنل مدیریت: {settings.FRONTEND_URL}/admin/orders/{order.id}
            """.strip()

            admin_emails = getattr(settings, 'ADMIN_EMAIL_LIST', ['admin@company.com'])

            success_count = 0
            for admin_email in admin_emails:
                try:
                    send_mail(
                        subject=subject,
                        message=message,
                        from_email=settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[admin_email],
                        fail_silently=False,
                    )
                    success_count += 1
                    logger.info(f"✅ Payment upload notification sent to admin: {admin_email}")
                except Exception as e:
                    logger.error(f"❌ Failed to send payment upload notification to {admin_email}: {e}")

            return success_count > 0

        except Exception as e:
            logger.error(f"❌ Failed to send payment upload notification: {e}")
            return False

    @staticmethod
    def notify_customer_order_completed(order, include_invoice=True):
        """NEW: Notify customer when order is completed + invoice"""
        try:
            subject = f"سفارش #{order.id} تکمیل شد - آماده تحویل"

            message = f"""
    {order.customer.name} عزیز،

    خبر خوش! سفارش شماره #{order.id} با موفقیت تکمیل شد و آماده تحویل است.

    📦 جزئیات سفارش:
    - شماره سفارش: #{order.id}
    - مبلغ نهایی: {order.quoted_total:,.0f} ریال
    - تعداد اقلام: {order.items.count()} محصول
    - تاریخ تکمیل: {order.updated_at.strftime('%Y/%m/%d %H:%M')}

    🚚 مراحل بعدی:
    1. کالاهای شما بسته‌بندی و آماده ارسال شده‌اند
    2. برای هماهنگی نحوه تحویل با شما تماس خواهیم گرفت
    3. فاکتور نهایی به این ایمیل ضمیمه شده است

    📄 مدارک ضمیمه:
    - فاکتور رسمی سفارش
    - لیست کالاهای ارسالی

    📞 اطلاعات تماس:
    تلفن: {getattr(settings, 'BUSINESS_PHONE', '035-91007711')}
    ایمیل: {getattr(settings, 'SUPPORT_EMAIL', 'sales@gtc.market')}

    از اعتماد شما سپاسگزاریم و امیدواریم از خرید خود راضی باشید.

    با تشکر،
    تیم فروش کیان تجارت پویا کویر
            """.strip()

            # Generate invoice attachment if requested
            attachment = None
            if include_invoice:
                try:
                    # Check if order is official or unofficial and use appropriate service
                    if getattr(order, 'business_invoice_type', 'unofficial') == 'official':
                        # Use official enhanced Persian PDF
                        from ..services.enhanced_persian_pdf import EnhancedPersianInvoicePDFGenerator
                        generator = EnhancedPersianInvoicePDFGenerator(order.invoice)
                        invoice_pdf = generator.generate_pdf()
                        filename = f'official_invoice_order_{order.id}.pdf'
                    else:
                        # Use unofficial invoice PDF - FIXED IMPORT
                        from ..services.unofficial_invoice_pdf import UnofficialInvoicePDFGenerator
                        generator = UnofficialInvoicePDFGenerator(order, getattr(order, 'invoice', None))
                        invoice_pdf = generator.generate_pdf()
                        filename = f'unofficial_invoice_order_{order.id}.pdf'

                    if invoice_pdf:
                        attachment = {
                            'filename': filename,
                            'content': invoice_pdf.getvalue(),  # Get bytes from BytesIO
                            'mimetype': 'application/pdf'
                        }
                except Exception as e:
                    logger.warning(f"⚠️ Could not generate invoice for order {order.id}: {e}")

            # Send email using the enhanced method
            email_sent = NotificationService.send_email_with_tracking(
                order=order,
                email_type='order_completed',
                recipient_email=order.customer.email,
                subject=subject,
                html_content=message.replace('\n', '<br>'),
                attachment=attachment
            )

            # Also send SMS notification
            if order.customer.phone:
                sms_message = f"""سلام {order.customer.name}
    سفارش #{order.id} تکمیل شد!
    از خرید شما متشکریم.
    کیان تجارت پویا کویر"""

                NotificationService.send_sms_notification(
                    phone=order.customer.phone,
                    message=sms_message,
                    order=order,
                    sms_type='order_completed'
                )

            logger.info(f"📧 Order completed notification sent to {order.customer.email}")
            return email_sent

        except Exception as e:
            logger.error(f"❌ Failed to send order completed notification: {e}")
            EmailNotification.objects.create(
                order=order,
                email_type='order_completed',
                recipient_email=order.customer.email,
                subject=subject if 'subject' in locals() else f"سفارش #{order.id} تکمیل شد",
                is_successful=False,
                error_message=str(e)
            )
            return False






