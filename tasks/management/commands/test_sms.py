from django.core.management.base import BaseCommand
from tasks.services.sms_service import KavenegarSMSService


class Command(BaseCommand):
    help = 'Test SMS service with your Kavenegar configuration'

    def add_arguments(self, parser):
        parser.add_argument(
            '--phone',
            type=str,
            default='09902614909',  # Your test number
            help='Phone number to send test SMS to',
        )
        parser.add_argument(
            '--test-type',
            type=str,
            choices=['connection', 'simple', 'templated', 'otp', 'international'],
            default='connection',
            help='Type of test to perform',
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('🧪 Testing SMS Service with your Kavenegar config...'))

        try:
            # Initialize SMS service
            sms_service = KavenegarSMSService()
            self.stdout.write(self.style.SUCCESS('✅ SMS service initialized'))

            # Test connection
            if options['test_type'] == 'connection':
                test_result = sms_service.test_connection()
                if test_result['success']:
                    self.stdout.write(self.style.SUCCESS(f"✅ {test_result['message']}"))
                    self.stdout.write(f"📱 API Key: {test_result['api_key_preview']}")
                    self.stdout.write(f"📱 Domestic Sender: {test_result['domestic_sender']}")
                    self.stdout.write(f"📱 International Sender: {test_result['international_sender']}")
                else:
                    self.stdout.write(self.style.ERROR(f"❌ {test_result['error']}"))
                return

            phone = options['phone']
            clean_phone = KavenegarSMSService.clean_phone_number(phone)
            if not clean_phone:
                self.stdout.write(self.style.ERROR(f'❌ Invalid phone number: {phone}'))
                return

            self.stdout.write(f'📱 Sending test SMS to: {clean_phone}')

            # Perform test based on type
            if options['test_type'] == 'simple':
                result = sms_service.send_sms(
                    receptor=clean_phone,
                    message='🧪 تست سرویس پیامک - یان تجارت پویا کویر',
                    sms_type='test'
                )

                if result['success']:
                    self.stdout.write(self.style.SUCCESS('✅ Test SMS sent successfully'))
                    self.stdout.write(f"📱 Sender used: {result.get('sender', 'Unknown')}")
                    self.stdout.write(f"📱 Response: {result.get('response', 'N/A')}")
                else:
                    self.stdout.write(self.style.ERROR(f"❌ SMS failed: {result['error']}"))

            elif options['test_type'] == 'templated':
                # Test templated SMS
                context = {
                    'customer_name': 'آقای تست',
                    'order_id': '12345',
                    'total_amount': 150000
                }

                result = sms_service.send_templated_sms(
                    phone=clean_phone,
                    template_key='pricing_ready',
                    context_data=context,
                    sms_type='test_template'
                )

                if result['success']:
                    self.stdout.write(self.style.SUCCESS('✅ Templated SMS sent successfully'))
                else:
                    self.stdout.write(self.style.ERROR(f"❌ Templated SMS failed: {result['error']}"))

            elif options['test_type'] == 'otp':
                result = sms_service.send_otp_sms(
                    receptor=clean_phone,
                    token='12345',
                    template='verify',
                    sms_type='test_otp'
                )

                if result['success']:
                    self.stdout.write(self.style.SUCCESS('✅ OTP SMS sent successfully'))
                else:
                    self.stdout.write(self.style.ERROR(f"❌ OTP SMS failed: {result['error']}"))

            elif options['test_type'] == 'international':
                # Test international number (you can modify this)
                intl_phone = '+1234567890'  # Example international number

                result = sms_service.send_sms(
                    receptor=intl_phone,
                    message='Test international SMS - Yan Tejarat Puya Kavir',
                    sms_type='test_international'
                )

                if result['success']:
                    self.stdout.write(self.style.SUCCESS('✅ International SMS sent successfully'))
                    self.stdout.write(f"📱 Sender used: {result.get('sender', 'Unknown')}")
                else:
                    self.stdout.write(self.style.ERROR(f"❌ International SMS failed: {result['error']}"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ SMS test failed: {str(e)}'))

        self.stdout.write(self.style.SUCCESS('🎯 SMS service test completed.'))