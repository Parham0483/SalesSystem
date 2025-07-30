import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import logging

logger = logging.getLogger(__name__)
Customer = get_user_model()


class GoogleOAuthService:
    """Google OAuth service for authentication using ID tokens"""

    @staticmethod
    def verify_google_id_token(id_token_string):
        """
        Verify Google ID token and get user info
        This is more secure than using access tokens
        """
        try:
            # Get Google Client ID from settings
            google_client_id = getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', None)

            if not google_client_id:
                logger.error("❌ GOOGLE_OAUTH_CLIENT_ID not configured in settings")
                return None, "Google OAuth not configured"

            # Verify the ID token
            idinfo = id_token.verify_oauth2_token(
                id_token_string,
                google_requests.Request(),
                google_client_id
            )

            # Validate the token issuer
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                logger.error("❌ Invalid token issuer")
                return None, "Invalid token issuer"

            # Validate required fields
            if not idinfo.get('email'):
                return None, "Email not provided by Google"

            if not idinfo.get('email_verified', True):
                return None, "Email not verified with Google"

            logger.info(f"✅ Google ID token verified for: {idinfo.get('email')}")
            return idinfo, None

        except ValueError as e:
            logger.error(f"❌ Google ID token verification failed: {str(e)}")
            return None, "Invalid Google token"
        except Exception as e:
            logger.error(f"❌ Google token verification error: {str(e)}")
            return None, "Token verification failed"

    @staticmethod
    def get_or_create_user_from_google(google_user_data):
        """
        Get existing user or create new one from Google data
        """
        try:
            email = google_user_data['email']
            google_id = google_user_data.get('sub')  # 'sub' is the user ID in ID tokens
            name = google_user_data.get('name', '')
            given_name = google_user_data.get('given_name', '')
            family_name = google_user_data.get('family_name', '')
            picture = google_user_data.get('picture', '')

            # Construct full name if not provided
            if not name:
                name = f"{given_name} {family_name}".strip()
            if not name:
                name = email.split('@')[0]  # Fallback to email prefix

            # Try to find existing user by email
            try:
                user = Customer.objects.get(email=email)

                # Update Google ID if not set
                if not user.google_id:
                    user.google_id = google_id
                    user.save(update_fields=['google_id'])

                # Update name if it was previously empty or default
                if not user.name or user.name == email.split('@')[0]:
                    user.name = name
                    user.save(update_fields=['name'])

                logger.info(f"✅ Existing user found: {email}")
                return user, False, None  # user, created, error

            except Customer.DoesNotExist:
                # Create new user from Google data
                user = Customer.objects.create_user(
                    email=email,
                    name=name,
                    password=None,  # No password for Google users initially
                    is_active=True,
                    google_id=google_id
                )

                # Set a random password (user can change it later if needed)
                import secrets
                random_password = secrets.token_urlsafe(16)
                user.set_password(random_password)
                user.save()

                logger.info(f"✅ New Google user created: {email}")
                return user, True, None  # user, created, error

        except Exception as e:
            logger.error(f"❌ Error creating/getting user from Google: {str(e)}")
            return None, False, str(e)

    @staticmethod
    def generate_tokens_for_user(user):
        """Generate JWT tokens for user"""
        try:
            refresh = RefreshToken.for_user(user)
            return {
                'access': str(refresh.access_token),
                'refresh': str(refresh)
            }
        except Exception as e:
            logger.error(f"❌ Error generating tokens: {str(e)}")
            return None