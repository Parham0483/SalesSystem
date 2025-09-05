# tasks/services/oauth2_email_backend.py

import base64
import json
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from django.core.mail.backends.base import BaseEmailBackend
from django.conf import settings
import logging
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import requests

logger = logging.getLogger(__name__)


class OAuth2EmailBackend(BaseEmailBackend):
    """
    Gmail OAuth2 Email Backend using Service Account with User Impersonation
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.service_account_info = None
        self.access_token = None
        self.token_expiry = None

    def _load_service_account(self):
        """Load service account credentials from file"""
        try:
            service_account_path = getattr(settings, 'GOOGLE_SERVICE_ACCOUNT_PATH', None)
            if service_account_path:
                with open(service_account_path, 'r') as f:
                    self.service_account_info = json.load(f)
            else:
                # Load from settings directly (if you embed the JSON)
                self.service_account_info = getattr(settings, 'GOOGLE_SERVICE_ACCOUNT_INFO', None)

            if not self.service_account_info:
                raise ValueError("Google service account credentials not found")

        except Exception as e:
            logger.error(f"Failed to load service account: {e}")
            raise

    def _get_access_token(self):
        """Get OAuth2 access token using service account with user impersonation"""
        try:
            if not self.service_account_info:
                self._load_service_account()

            # Check if we have a valid token
            if self.access_token and self.token_expiry and time.time() < self.token_expiry:
                return self.access_token

            # CRITICAL: Impersonate the from_email user
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'sale@gtc.market')

            # Create credentials with user impersonation
            credentials = service_account.Credentials.from_service_account_info(
                self.service_account_info,
                scopes=['https://www.googleapis.com/auth/gmail.send'],
                subject=from_email  # This is the key fix!
            )

            # Get the access token
            credentials.refresh(Request())

            self.access_token = credentials.token
            self.token_expiry = credentials.expiry.timestamp() if credentials.expiry else time.time() + 3600

            logger.info(f"OAuth2 token obtained for user: {from_email}")
            return self.access_token

        except Exception as e:
            logger.error(f"Failed to get access token: {e}")
            raise

    def _create_message(self, email_message):
        """Create email message in Gmail API format"""
        try:
            # Create MIME message
            if email_message.alternatives:
                # HTML email
                msg = MIMEMultipart('alternative')

                # Plain text part
                text_part = MIMEText(email_message.body, 'plain', 'utf-8')
                msg.attach(text_part)

                # HTML part
                for content, mimetype in email_message.alternatives:
                    if mimetype == 'text/html':
                        html_part = MIMEText(content, 'html', 'utf-8')
                        msg.attach(html_part)
            else:
                # Plain text email
                msg = MIMEText(email_message.body, 'plain', 'utf-8')

            # Set headers
            msg['To'] = ', '.join(email_message.to)
            msg['From'] = email_message.from_email
            msg['Subject'] = email_message.subject

            if email_message.cc:
                msg['Cc'] = ', '.join(email_message.cc)
            if email_message.bcc:
                msg['Bcc'] = ', '.join(email_message.bcc)
            if email_message.reply_to:
                msg['Reply-To'] = ', '.join(email_message.reply_to)

            # Handle attachments
            if email_message.attachments:
                if not isinstance(msg, MIMEMultipart):
                    # Convert to multipart if we have attachments
                    original_msg = msg
                    msg = MIMEMultipart()
                    msg.attach(original_msg)
                    # Copy headers
                    for key, value in original_msg.items():
                        msg[key] = value

                for attachment in email_message.attachments:
                    if isinstance(attachment, tuple):
                        filename, content, mimetype = attachment
                        attachment_part = MIMEApplication(content, _subtype=mimetype.split('/')[-1])
                        attachment_part.add_header('Content-Disposition', 'attachment', filename=filename)
                        msg.attach(attachment_part)

            # Encode message
            raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode('utf-8')
            return {'raw': raw_message}

        except Exception as e:
            logger.error(f"Failed to create message: {e}")
            raise

    def send_messages(self, email_messages):
        """Send email messages using Gmail API"""
        if not email_messages:
            return 0

        try:
            access_token = self._get_access_token()
            sent_count = 0

            for email_message in email_messages:
                try:
                    # Create message
                    message = self._create_message(email_message)

                    # Send via Gmail API
                    headers = {
                        'Authorization': f'Bearer {access_token}',
                        'Content-Type': 'application/json'
                    }

                    response = requests.post(
                        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                        headers=headers,
                        json=message,
                        timeout=30
                    )

                    if response.status_code == 200:
                        sent_count += 1
                        logger.info(f"OAuth2 email sent successfully: {email_message.subject}")
                    else:
                        logger.error(f"Failed to send email: {response.status_code} - {response.text}")
                        if not self.fail_silently:
                            raise Exception(f"Gmail API error: {response.status_code}")

                except Exception as e:
                    logger.error(f"Error sending individual email: {e}")
                    if not self.fail_silently:
                        raise

            return sent_count

        except Exception as e:
            logger.error(f"OAuth2 email backend error: {e}")
            if not self.fail_silently:
                raise
            return 0