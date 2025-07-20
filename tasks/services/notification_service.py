
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
from ..models import EmailNotification
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Handle Persian email notifications for order workflow"""

    @staticmethod
    def send_email_with_tracking(order, email_type, recipient_email, subject, html_content, attachment=None):
        """Send email and track in database"""
        notification = EmailNotification.objects.create(
            order=order,
            email_type=email_type,
            recipient_email=recipient_email,
            subject=subject,
            is_successful=False
        )

        try:
            # Create email message
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

            # Send email
            msg.send()

            notification.is_successful = True
            notification.save()

            logger.info(f"✅ Email sent successfully: {email_type} to {recipient_email} for Order #{order.id}")
            return True

        except Exception as e:
            notification.error_message = str(e)
            notification.save()
            logger.error(f"❌ Email failed: {email_type} to {recipient_email} for Order #{order.id} - {str(e)}")
            return False

    @staticmethod
    def notify_admin_new_order(order):
        """Step 1: Notify admin when customer submits order"""
        try:
            subject = f"سفارش جدید #{order.id} - {order.customer.name}"

            context = {
                'order': order,
                'customer': order.customer,
                'items_count': order.items.count(),
                'dashboard_url': f"{settings.FRONTEND_URL}/admin"  # Add this to settings
            }

            html_content = render_to_string('emails/new_order_admin_fa.html', context)

            # Send to all admin emails
            admin_emails = getattr(settings, 'ADMIN_EMAIL_LIST', ['admin@company.com'])

            success_count = 0
            for admin_email in admin_emails:
                if NotificationService.send_email_with_tracking(
                        order, 'order_submitted', admin_email, subject, html_content
                ):
                    success_count += 1

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

            context = {
                'order': order,
                'customer': order.customer,
                'total_amount': order.quoted_total,
                'order_url': f"{settings.FRONTEND_URL}/dashboard"  # Add this to settings
            }

            html_content = render_to_string('emails/pricing_ready_fa.html', context)

            success = NotificationService.send_email_with_tracking(
                order, 'pricing_ready', order.customer.email, subject, html_content
            )

            if success:
                logger.info(f"📧 Step 2: Pricing ready notification sent to {order.customer.email}")

            return success

        except Exception as e:
            logger.error(f"❌ Failed to send pricing ready notification: {e}")
            return False

    @staticmethod
    def notify_customer_order_confirmed(order, include_pdf=True):
        """Step 3a: Notify customer when they confirm order (with PDF)"""
        try:
            subject = f"سفارش #{order.id} تأیید شد - فاکتور ضمیمه"

            context = {
                'order': order,
                'customer': order.customer,
                'total_amount': order.quoted_total,
                'completion_message': "سفارش شما با موفقیت تأیید شد و در حال پردازش است."
            }

            html_content = render_to_string('emails/order_confirmed_fa.html', context)

            # Generate PDF attachment if requested
            attachment = None
            if include_pdf:
                try:
                    # Get or create invoice
                    invoice = getattr(order, 'invoice', None)
                    if not invoice:
                        from ..models import Invoice
                        invoice = Invoice.objects.create(
                            order=order,
                            invoice_type='final_invoice',
                            total_amount=order.quoted_total,
                            is_finalized=True,
                            invoice_number=order.generate_invoice_number()
                        )

                    # Generate PDF
                    from .persian_pdf_generator import PersianInvoicePDFGenerator
                    generator = PersianInvoicePDFGenerator(invoice)
                    pdf_buffer = generator.generate_pdf()

                    attachment = {
                        'filename': f'invoice_{order.id}.pdf',
                        'content': pdf_buffer.getvalue(),
                        'mimetype': 'application/pdf'
                    }

                except Exception as pdf_error:
                    logger.error(f"❌ Failed to generate PDF for order #{order.id}: {pdf_error}")
                    # Still send email without PDF

            success = NotificationService.send_email_with_tracking(
                order, 'order_confirmed', order.customer.email, subject, html_content, attachment
            )

            if success:
                logger.info(f"📧 Step 3a: Order confirmed notification sent to {order.customer.email} with PDF")

            return success

        except Exception as e:
            logger.error(f"❌ Failed to send order confirmed notification: {e}")
            return False

    @staticmethod
    def notify_customer_order_rejected(order, rejection_reason):
        """Step 3b: Notify customer when they reject order (with reason)"""
        try:
            subject = f"سفارش #{order.id} رد شد"

            context = {
                'order': order,
                'customer': order.customer,
                'rejection_reason': rejection_reason,
                'support_email': getattr(settings, 'SUPPORT_EMAIL', 'support@company.com')
            }

            html_content = render_to_string('emails/order_rejected_fa.html', context)

            success = NotificationService.send_email_with_tracking(
                order, 'order_rejected', order.customer.email, subject, html_content
            )

            if success:
                logger.info(f"📧 Step 3b: Order rejected notification sent to {order.customer.email}")

            return success

        except Exception as e:
            logger.error(f"❌ Failed to send order rejected notification: {e}")
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

            context = {
                'order': order,
                'customer': order.customer,
                'new_status': new_status,
                'status_text': status_text,
                'changed_by': user.name if user else 'سیستم'
            }

            html_content = render_to_string('emails/admin_status_change_fa.html', context)

            admin_emails = getattr(settings, 'ADMIN_EMAIL_LIST', ['admin@company.com'])

            success_count = 0
            for admin_email in admin_emails:
                if NotificationService.send_email_with_tracking(
                        order, 'order_status_change', admin_email, subject, html_content
                ):
                    success_count += 1

            return success_count > 0

        except Exception as e:
            logger.error(f"❌ Failed to send admin status change notification: {e}")
            return False






# Create tasks/templates/emails/order_rejected_fa.html
"""
<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>سفارش رد شد</title>
    <style>
        body {
            font-family: Tahoma, Arial, sans-serif;
            direction: rtl;
            text-align: right;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border: 4px solid #000;
            padding: 30px;
        }
        .header {
            background-color: #f87171;
            color: white;
            padding: 20px;
            margin: -30px -30px 20px -30px;
            border-bottom: 4px solid #000;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .rejection-box {
            background-color: #fef2f2;
            border: 4px solid #ef4444;
            padding: 20px;
            margin: 20px 0;
        }
        .reason-box {
            background-color: #f8f9fa;
            border: 2px solid #000;
            padding: 15px;
            margin: 15px 0;
        }
        .contact-box {
            background-color: #dbeafe;
            border: 2px solid #3b82f6;
            padding: 15px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>❌ سفارش رد شد</h1>
        </div>

        <p>{{ customer.name }} عزیز،</p>

        <div class="rejection-box">
            <p>متأسفانه سفارش شماره <strong>{{ order.id }}</strong> توسط شما رد شده است.</p>
        </div>

        <div class="reason-box">
            <h3>دلیل رد سفارش:</h3>
            <p>{{ rejection_reason }}</p>
        </div>

        <div class="contact-box">
            <h3>📞 نیاز به مشاوره دارید؟</h3>
            <p>تیم فروش ما آماده پاسخگویی و ارائه راهکارهای مناسب‌تر است.</p>
            <p><strong>ایمیل پشتیبانی:</strong> {{ support_email }}</p>
            <p>ما همچنان منتظر همکاری دوباره با شما هستیم.</p>
        </div>

        <p>با احترام،</p>
        <p><strong>تیم فروش</strong></p>
    </div>
</body>
</html>
"""