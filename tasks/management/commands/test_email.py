# tasks/management/commands/test_email.py
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings
from tasks.services.notification_service import NotificationService


class Command(BaseCommand):
    help = 'Test email configuration'

    def add_arguments(self, parser):
        parser.add_argument(
            '--to',
            type=str,
            default=settings.DEFAULT_FROM_EMAIL,
            help='Email address to send test email to',
        )

    def handle(self, *args, **options):
        recipient = options['to']

        self.stdout.write(self.style.WARNING(f'🧪 Testing email configuration...'))
        self.stdout.write(f'📧 Sending test email to: {recipient}')
        self.stdout.write(f'📤 From: {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'🌐 SMTP Host: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}')
        self.stdout.write(f'🔐 TLS: {settings.EMAIL_USE_TLS}')

        try:
            # Test simple email
            send_mail(
                subject='🧪 Django Email Test - Configuration Working',
                message='''This is a test email to verify that your Django email configuration is working correctly.

If you received this email, your email settings are properly configured!

Email Settings Used:
- Host: {host}
- Port: {port}
- TLS: {tls}
- From: {from_email}

Best regards,
Django Email Test System'''.format(
                    host=settings.EMAIL_HOST,
                    port=settings.EMAIL_PORT,
                    tls=settings.EMAIL_USE_TLS,
                    from_email=settings.DEFAULT_FROM_EMAIL
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )

            self.stdout.write(self.style.SUCCESS('✅ Test email sent successfully!'))
            self.stdout.write('📬 Check your inbox for the test email.')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Failed to send test email: {str(e)}'))
            self.stdout.write(self.style.WARNING('💡 Troubleshooting tips:'))
            self.stdout.write('   • Check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in settings.py')
            self.stdout.write('   • Verify Gmail App Password is correct (not your regular password)')
            self.stdout.write('   • Ensure 2-factor authentication is enabled for Gmail')
            self.stdout.write('   • Check your internet connection')
            self.stdout.write('   • Try using port 465 with EMAIL_USE_SSL=True instead of TLS')

        # Also test the notification service
        self.stdout.write(self.style.WARNING(f'\n🔧 Testing NotificationService...'))

        try:
            result = NotificationService.test_email_configuration()
            if result:
                self.stdout.write(self.style.SUCCESS('✅ NotificationService test passed!'))
            else:
                self.stdout.write(self.style.ERROR('❌ NotificationService test failed!'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ NotificationService error: {str(e)}'))

        self.stdout.write(self.style.SUCCESS('\n🎯 Email configuration test completed.'))