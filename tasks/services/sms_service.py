from kavenegar import KavenegarAPI, APIException, HTTPException
from django.conf import settings
from django.utils import timezone
from ..models import Customer, Order, SMSNotification
import logging
import re

logger = logging.getLogger(__name__)


class KavenegarSMSService:
    """Simplified SMS service for Iranian domestic numbers only"""

    def __init__(self):
        self.api_key = settings.KAVENEGAR_API_KEY
        self.sender_domestic = settings.KAVENEGAR_SENDER_DOMESTIC

        if not self.api_key:
            logger.error("❌ KAVENEGAR_API_KEY not configured in settings")
            raise ValueError("Kavenegar API key is required")

        self.api = KavenegarAPI(self.api_key)

    def send_sms(self, receptor, message, order=None, sms_type='general', announcement=None, dealer=None):
        """
        Send SMS - Simplified for Iranian domestic numbers only
        Expects phone numbers in 09xxxxxxxxx format (11 digits)
        """

        # Check if SMS is enabled
        if not getattr(settings, 'SMS_NOTIFICATIONS_ENABLED', False):
            logger.info("📱 SMS notifications are disabled")
            return {'success': False, 'error': 'SMS notifications disabled'}

        # Clean and validate phone number for Iranian format
        clean_phone = self.clean_iranian_phone(receptor)
        if not clean_phone:
            logger.error(f"❌ Invalid Iranian phone number: {receptor}")
            return {'success': False, 'error': f'Invalid Iranian phone number: {receptor}'}

        # Truncate message if too long (Persian SMS limit)
        max_length = 150
        if len(message) > max_length:
            message = message[:max_length - 3] + '...'

        # Check for duplicate prevention
        if self.is_duplicate_sms(clean_phone, message, sms_type):
            logger.warning(f"⚠️ Duplicate SMS prevented for {clean_phone}")
            return {'success': False, 'error': 'Duplicate SMS prevented'}

        # Create SMS notification record
        notification = SMSNotification.objects.create(
            order=order,
            announcement=announcement,
            dealer=dealer,
            sms_type=sms_type,
            recipient_phone=clean_phone,
            message=message,
            is_successful=False
        )

        try:
            # Check if in test mode
            if getattr(settings, 'SMS_CONFIG', {}).get('use_test_mode', False):
                logger.info(f"📱 Test mode: SMS would be sent to {clean_phone}")
                notification.is_successful = True
                notification.kavenegar_response = "Test mode - SMS not actually sent"
                notification.save()
                return {'success': True, 'message': 'Test mode - SMS logged only'}

            # Send SMS using domestic sender
            params = {
                'sender': self.sender_domestic,  # Always use domestic sender
                'receptor': clean_phone,  # Phone in 09xxxxxxxxx format
                'message': message,
            }

            logger.info(f"📱 Sending SMS: {self.sender_domestic} -> {clean_phone} (length: {len(message)})")

            response = self.api.sms_send(params)

            # Log successful SMS
            logger.info(f"✅ SMS sent successfully to {clean_phone}")
            logger.info(f"📱 API Response: {response}")

            # Update notification record
            notification.is_successful = True
            notification.kavenegar_response = str(response)

            # Extract cost and message ID if available
            if response and len(response) > 0:
                result = response[0]
                if hasattr(result, 'cost'):
                    notification.cost = result.cost
                if hasattr(result, 'messageid'):
                    notification.message_id = str(result.messageid)

            notification.save()

            return {
                'success': True,
                'response': response,
                'message': 'SMS sent successfully',
                'sender': self.sender_domestic,
                'receptor': clean_phone
            }

        except APIException as e:
            error_msg = f"Kavenegar API Error: {str(e)}"
            logger.error(f"❌ {error_msg}")

            notification.error_message = error_msg
            notification.save()

            return {
                'success': False,
                'error': error_msg,
                'type': 'api_error'
            }

        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"❌ {error_msg}")

            notification.error_message = error_msg
            notification.save()

            return {
                'success': False,
                'error': error_msg,
                'type': 'general_error'
            }

    def clean_iranian_phone(self, phone):
        """
        Clean and validate Iranian phone numbers to 09xxxxxxxxx format only

        Accepted inputs:
        - 09121234567 -> 09121234567 ✅
        - 9121234567  -> 09121234567 ✅
        - 021234567   -> 09121234567 ✅ (remove leading 0, add 09)
        - +989121234567 -> 09121234567 ✅
        - 989121234567  -> 09121234567 ✅
        """
        if not phone:
            return None

        # Remove all non-digit characters (removes +, spaces, etc.)
        phone = re.sub(r'\D', '', str(phone))

        if not phone:
            return None

        logger.info(f"📱 Cleaning Iranian phone: '{phone}' (length: {len(phone)})")

        # Handle different input formats
        if phone.startswith('09') and len(phone) == 11:
            # Already in correct format: 09xxxxxxxxx
            if self.is_valid_iranian_mobile_prefix(phone):
                logger.info(f"✅ Phone already in correct format: {phone}")
                return phone
            else:
                logger.warning(f"❌ Invalid Iranian mobile prefix: {phone}")
                return None

        elif phone.startswith('9') and len(phone) == 10:
            # Missing leading 0: 9xxxxxxxxx -> 09xxxxxxxxx
            result = '0' + phone
            if self.is_valid_iranian_mobile_prefix(result):
                logger.info(f"✅ Added leading 0: {phone} -> {result}")
                return result
            else:
                logger.warning(f"❌ Invalid prefix after adding 0: {result}")
                return None

        elif phone.startswith('989') and len(phone) == 12:
            # International format: 989xxxxxxxxx -> 09xxxxxxxxx
            result = '0' + phone[2:]  # Remove '98', add '0'
            if self.is_valid_iranian_mobile_prefix(result):
                logger.info(f"✅ Converted from international: {phone} -> {result}")
                return result
            else:
                logger.warning(f"❌ Invalid result after international conversion: {result}")
                return None

        elif phone.startswith('98') and len(phone) == 12:
            # International without 9: 98xxxxxxxxxx -> might be wrong
            logger.warning(f"❌ Ambiguous international format: {phone}")
            return None

        else:
            logger.warning(f"❌ Unsupported phone format: {phone} (length: {len(phone)})")
            return None

    def is_valid_iranian_mobile_prefix(self, phone):
        """
        Check if phone number has valid Iranian mobile operator prefix
        Valid prefixes: 0901, 0902, 0903, 0905, 0912, 0913, 0914, 0915, 0916, 0917, 0918, 0919, 0990, 0991, 0992, 0993, 0994, 0995, 0996, 0997, 0998, 0999
        """
        if not phone or len(phone) != 11 or not phone.startswith('09'):
            return False

        # Iranian mobile operator prefixes (first 4 digits)
        valid_prefixes = [
            '0901', '0902', '0903', '0905',  # Hamrah-e Avval (MCI)
            '0912', '0913', '0914', '0915', '0916', '0917', '0918', '0919',  # Irancell
            '0990', '0991', '0992', '0993', '0994', '0995', '0996', '0997', '0998', '0999'  # Various operators
        ]

        prefix = phone[:4]
        is_valid = prefix in valid_prefixes

        if not is_valid:
            logger.warning(f"❌ Invalid Iranian mobile prefix: {prefix}")
            logger.info(f"📱 Valid prefixes include: 0901, 0902, 0912, 0913, 0990, etc.")

        return is_valid

    def is_duplicate_sms(self, phone, message, sms_type):
        """
        ENHANCED: Check for duplicate SMS to prevent sending the same message multiple times
        """
        from datetime import timedelta

        # Check for recent SMS (within last 5 minutes) with same content
        recent_time = timezone.now() - timedelta(minutes=5)

        # Check for exact duplicates
        exact_duplicate = SMSNotification.objects.filter(
            recipient_phone=phone,
            message=message,
            sms_type=sms_type,
            sent_at__gte=recent_time,
            is_successful=True
        ).exists()

        if exact_duplicate:
            logger.warning(f"🔄 Exact duplicate SMS prevented: {sms_type} to {phone}")
            return True

        # ENHANCED: Check for similar messages (same type and similar content)
        # This catches cases where message content is slightly different but essentially the same
        if sms_type in ['order_submitted', 'pricing_ready', 'order_confirmed']:
            # For order-related SMS, check for any successful SMS of same type within last 2 minutes
            recent_same_type = SMSNotification.objects.filter(
                recipient_phone=phone,
                sms_type=sms_type,
                sent_at__gte=timezone.now() - timedelta(minutes=2),
                is_successful=True
            ).exists()

            if recent_same_type:
                logger.warning(f"🔄 Similar SMS type prevented: {sms_type} to {phone} (within 2 minutes)")
                return True

        return False

    def send_templated_sms(self, phone, template_key, context_data, order=None, sms_type='templated'):
        """
        Send SMS using predefined templates from settings
        """
        templates = getattr(settings, 'SMS_TEMPLATES', {})
        template = templates.get(template_key)

        if not template:
            logger.error(f"❌ SMS template '{template_key}' not found")
            return {'success': False, 'error': f'Template {template_key} not found'}

        try:
            # Format template with context data
            message = template.format(**context_data)

            return self.send_sms(
                receptor=phone,
                message=message,
                order=order,
                sms_type=sms_type
            )

        except KeyError as e:
            error_msg = f"Missing template variable: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return {'success': False, 'error': error_msg}

    def test_connection(self):
        """Test Kavenegar API connection"""
        try:
            logger.info("🧪 Testing Kavenegar connection...")
            logger.info(f"📱 API Key: {self.api_key[:20]}...")
            logger.info(f"📱 Domestic Sender: {self.sender_domestic}")

            return {
                'success': True,
                'message': 'Kavenegar API configuration is valid',
                'api_key_preview': self.api_key[:20] + '...',
                'domestic_sender': self.sender_domestic
            }

        except Exception as e:
            logger.error(f"❌ Kavenegar connection test failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def clean_phone_number(phone):
        """
        Static method for backward compatibility
        """
        try:
            service = KavenegarSMSService()
            return service.clean_iranian_phone(phone)
        except:
            return None

    def debug_phone_number(self, phone):
        """
        Debug phone number cleaning process
        """
        logger.info(f"🔍 DEBUG: Analyzing phone number: '{phone}'")

        if not phone:
            logger.info("🔍 DEBUG: Phone is None or empty")
            return {'original': phone, 'cleaned': None, 'is_valid': False}

        # Remove non-digits
        digits_only = re.sub(r'\D', '', str(phone))
        logger.info(f"🔍 DEBUG: Digits only: '{digits_only}' (length: {len(digits_only)})")

        # Apply cleaning
        cleaned = self.clean_iranian_phone(phone)
        logger.info(f"🔍 DEBUG: Cleaned result: '{cleaned}'")

        # Validate
        is_valid = False
        if cleaned:
            is_valid = self.is_valid_iranian_mobile_prefix(cleaned)
            logger.info(f"🔍 DEBUG: Is valid Iranian mobile: {is_valid}")

        return {
            'original': phone,
            'digits_only': digits_only,
            'cleaned': cleaned,
            'is_valid': is_valid
        }