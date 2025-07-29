# tasks/management/commands/test_iranian_sms.py
from django.core.management.base import BaseCommand
from tasks.services.sms_service import KavenegarSMSService


class Command(BaseCommand):
    help = 'Test Iranian SMS service with proper format'

    def add_arguments(self, parser):
        parser.add_argument(
            '--phone',
            type=str,
            default='09902614909',
            help='Phone number to test (Iranian format)',
        )

    def handle(self, *args, **options):
        phone = options['phone']

        self.stdout.write(self.style.WARNING(f'🧪 Testing Iranian SMS service with: {phone}'))

        try:
            # Initialize SMS service
            sms_service = KavenegarSMSService()

            # Test phone number cleaning
            debug_result = sms_service.debug_phone_number(phone)

            self.stdout.write('📱 Phone Number Analysis:')
            self.stdout.write(f'   Original: {debug_result["original"]}')
            self.stdout.write(f'   Digits Only: {debug_result["digits_only"]}')
            self.stdout.write(f'   Cleaned: {debug_result["cleaned"]}')
            self.stdout.write(f'   Is Valid: {debug_result["is_valid"]}')

            if not debug_result["is_valid"]:
                self.stdout.write(self.style.ERROR('❌ Phone number is invalid, cannot send SMS'))
                return

            # Test different phone formats
            self.stdout.write('\n🧪 Testing different phone formats:')
            test_formats = [
                '09902614909',  # Standard format
                '9902614909',  # Without leading 0
                '989902614909',  # International format
                '+989902614909',  # With + prefix
                '0 99 026 14909',  # With spaces
            ]

            for test_phone in test_formats:
                result = sms_service.debug_phone_number(test_phone)
                status = "✅" if result["is_valid"] else "❌"
                self.stdout.write(f'   {status} {test_phone} -> {result["cleaned"]}')

            # Send test SMS
            self.stdout.write('\n📱 Sending test SMS...')

            test_message = f"""سلام!
این یک پیام تست است.
شماره شما: {debug_result["cleaned"]}
کیان تجارت پویا کویر"""

            result = sms_service.send_sms(
                receptor=debug_result["cleaned"],
                message=test_message,
                sms_type='test'
            )

            if result['success']:
                self.stdout.write(self.style.SUCCESS('✅ Test SMS sent successfully!'))
                self.stdout.write(f'📱 Sender: {result.get("sender")}')
                self.stdout.write(f'📱 Receptor: {result.get("receptor")}')

                if 'response' in result and result['response']:
                    response = result['response'][0] if result['response'] else {}
                    if hasattr(response, 'messageid'):
                        self.stdout.write(f'📱 Message ID: {response.messageid}')
                    if hasattr(response, 'cost'):
                        self.stdout.write(f'💰 Cost: {response.cost}')
            else:
                self.stdout.write(self.style.ERROR(f'❌ Test SMS failed: {result["error"]}'))

            # Test duplicate prevention
            self.stdout.write('\n🔄 Testing duplicate prevention...')
            duplicate_result = sms_service.send_sms(
                receptor=debug_result["cleaned"],
                message=test_message,
                sms_type='test'
            )

            if not duplicate_result['success'] and 'duplicate' in duplicate_result.get('error', '').lower():
                self.stdout.write(self.style.SUCCESS('✅ Duplicate prevention working!'))
            elif duplicate_result['success']:
                self.stdout.write(self.style.WARNING('⚠️ Duplicate SMS was sent (prevention not working)'))
            else:
                self.stdout.write(f'❓ Unexpected result: {duplicate_result["error"]}')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Test failed: {str(e)}'))

        self.stdout.write(self.style.SUCCESS('\n🎯 Iranian SMS test completed.'))