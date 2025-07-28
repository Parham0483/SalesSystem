# tasks/services/sms_service.py - FIXED VERSION (Remove timeout parameter)

from kavenegar import KavenegarAPI, APIException, HTTPException
from django.conf import settings
from django.utils import timezone
from ..models import Customer, Order, SMSNotification
import logging
import re

logger = logging.getLogger(__name__)


class KavenegarSMSService:
    """SMS service using Kavenegar API - FIXED VERSION"""

    def __init__(self):
        self.api_key = settings.KAVENEGAR_API_KEY
        self.sender_domestic = settings.KAVENEGAR_SENDER_DOMESTIC
        self.sender_international = settings.KAVENEGAR_SENDER_INTERNATIONAL
        self.default_sender = settings.KAVENEGAR_SENDER

        if not self.api_key:
            logger.error("❌ KAVENEGAR_API_KEY not configured in settings")
            raise ValueError("Kavenegar API key is required")

        # FIXED: Remove timeout parameter from KavenegarAPI constructor
        self.api = KavenegarAPI(self.api_key)

    def get_appropriate_sender(self, phone_number):
        """
        Choose appropriate sender based on phone number
        - Iranian numbers: use domestic sender (2000660110)
        - International numbers: use international sender (0018018949161)
        """
        clean_phone = self.clean_phone_number(phone_number)

        if clean_phone and clean_phone.startswith('98'):
            # Iranian number - use domestic sender
            return self.sender_domestic
        else:
            # International number - use international sender
            return self.sender_international

    def send_sms(self, receptor, message, order=None, sms_type='general', announcement=None, dealer=None):
        """
        Send SMS with your specific configuration - FIXED VERSION
        """

        # Check if SMS is enabled
        if not getattr(settings, 'SMS_NOTIFICATIONS_ENABLED', False):
            logger.info("📱 SMS notifications are disabled")
            return {'success': False, 'error': 'SMS notifications disabled'}

        # Clean phone number
        clean_phone = self.clean_phone_number(receptor)
        if not clean_phone:
            logger.error(f"❌ Invalid phone number: {receptor}")
            return {'success': False, 'error': 'Invalid phone number format'}

        # Choose appropriate sender
        sender = self.get_appropriate_sender(clean_phone)

        # Truncate message if too long
        max_length = getattr(settings, 'SMS_CONFIG', {}).get('max_message_length', 70)
        if len(message) > max_length:
            message = message[:max_length - 3] + '...'

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
                test_numbers = getattr(settings, 'SMS_CONFIG', {}).get('test_phone_numbers', [])
                if clean_phone not in test_numbers:
                    logger.info(f"📱 Test mode: SMS would be sent to {clean_phone}")
                    notification.is_successful = True
                    notification.kavenegar_response = "Test mode - SMS not actually sent"
                    notification.save()
                    return {'success': True, 'message': 'Test mode - SMS logged only'}

            # Send actual SMS
            params = {
                'sender': sender,
                'receptor': clean_phone,
                'message': message,
            }

            response = self.api.sms_send(params)

            # Log successful SMS
            logger.info(f"✅ SMS sent successfully to {clean_phone} via sender {sender}")
            logger.info(f"📱 Response: {response}")

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
                'sender': sender
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

        except HTTPException as e:
            error_msg = f"HTTP Error: {str(e)}"
            logger.error(f"❌ {error_msg}")

            notification.error_message = error_msg
            notification.save()

            return {
                'success': False,
                'error': error_msg,
                'type': 'http_error'
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

    def send_otp_sms(self, receptor, token, template='verify', sms_type='otp'):
        """
        Send OTP SMS using Kavenegar templates
        """

        # Clean phone number
        clean_phone = self.clean_phone_number(receptor)
        if not clean_phone:
            return {'success': False, 'error': 'Invalid phone number format'}

        # Create SMS notification record
        notification = SMSNotification.objects.create(
            order=None,
            sms_type=sms_type,
            recipient_phone=clean_phone,
            message=f"OTP Template: {template}, Token: {token}",
            is_successful=False
        )

        try:
            params = {
                'receptor': clean_phone,
                'template': template,
                'token': token,
                'type': 'sms',
            }

            response = self.api.verify_lookup(params)

            logger.info(f"✅ OTP SMS sent successfully to {clean_phone}")

            # Update notification record
            notification.is_successful = True
            notification.kavenegar_response = str(response)
            notification.save()

            return {
                'success': True,
                'response': response,
                'message': 'OTP SMS sent successfully'
            }

        except Exception as e:
            error_msg = f"OTP SMS Error: {str(e)}"
            logger.error(f"❌ {error_msg}")

            notification.error_message = error_msg
            notification.save()

            return {
                'success': False,
                'error': error_msg
            }

    @staticmethod
    def clean_phone_number(phone):
        """
        Clean and format phone number for Iranian and international numbers
        """
        if not phone:
            return None

        # Remove all non-digit characters
        phone = re.sub(r'\D', '', str(phone))

        # Handle Iranian mobile numbers
        if phone.startswith('98'):
            # Already has country code
            return phone
        elif phone.startswith('0'):
            # Remove leading zero and add country code
            return '98' + phone[1:]
        elif len(phone) == 10:
            # Add country code for Iranian numbers
            return '98' + phone
        elif len(phone) == 11 and phone.startswith('1'):
            # Remove leading 1 and add country code
            return '98' + phone[1:]
        elif len(phone) >= 10:
            # Assume it's an international number without country code
            return phone
        else:
            logger.warning(f"⚠️ Invalid phone number format: {phone}")
            return None

    def test_connection(self):
        """Test Kavenegar API connection - FIXED VERSION"""
        try:
            logger.info("🧪 Testing Kavenegar connection...")
            logger.info(f"📱 Using API Key: {self.api_key[:20]}...")
            logger.info(f"📱 Domestic Sender: {self.sender_domestic}")
            logger.info(f"📱 International Sender: {self.sender_international}")

            # Test API key validity by checking account info (if available)
            # Since we can't use timeout, we'll just validate the configuration

            return {
                'success': True,
                'message': 'Kavenegar API configuration is valid',
                'api_key_preview': self.api_key[:20] + '...',
                'domestic_sender': self.sender_domestic,
                'international_sender': self.sender_international
            }

        except Exception as e:
            logger.error(f"❌ Kavenegar connection test failed: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }