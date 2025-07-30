from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from ..models import Customer
from ..services.google_oauth_service import GoogleOAuthService
from ..serializers.customers import AuthCustomerSerializer
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth(request):
    """
    Authenticate user with Google ID token
    """
    try:
        id_token_string = request.data.get('id_token')

        if not id_token_string:
            return Response({
                'error': 'Google ID token is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        logger.info("🔍 Processing Google ID token authentication...")

        # Verify Google ID token and get user data
        google_user_data, error = GoogleOAuthService.verify_google_id_token(id_token_string)

        if error:
            logger.error(f"❌ Google token verification failed: {error}")
            return Response({
                'error': error
            }, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"✅ Google token verified for user: {google_user_data.get('email')}")

        # Get or create user
        user, created, error = GoogleOAuthService.get_or_create_user_from_google(google_user_data)

        if error:
            logger.error(f"❌ User creation/retrieval failed: {error}")
            return Response({
                'error': f'User creation failed: {error}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=['last_login'])

        # Generate JWT tokens
        tokens = GoogleOAuthService.generate_tokens_for_user(user)

        if not tokens:
            logger.error("❌ Failed to generate JWT tokens")
            return Response({
                'error': 'Failed to generate authentication tokens'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Check if user needs to complete profile
        needs_profile_completion = not all([
            user.phone,  # Phone is required
            # company_name is optional
        ])

        # Use lightweight serializer for auth response
        auth_serializer = AuthCustomerSerializer(user)

        logger.info(
            f"✅ Google authentication successful for {user.email} (Created: {created}, Needs completion: {needs_profile_completion})")

        return Response({
            'message': 'Google authentication successful',
            'user': auth_serializer.data,
            'tokens': tokens,
            'created': created,
            'needs_profile_completion': needs_profile_completion,
            'missing_fields': {
                'phone': not bool(user.phone),
                'company_name': not bool(user.company_name)
            }
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"❌ Google authentication error: {str(e)}")
        return Response({
            'error': 'Google authentication failed'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def complete_google_profile(request):
    """
    Complete profile for Google authenticated users
    """
    try:
        email = request.data.get('email')
        phone = request.data.get('phone')
        company_name = request.data.get('company_name', '')

        if not email or not phone:
            return Response({
                'error': 'Email and phone are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"🔄 Completing profile for Google user: {email}")

        # Validate phone format (Iranian)
        import re
        phone_digits = re.sub(r'\D', '', str(phone))
        if not phone_digits.startswith(('09', '989')) or len(phone_digits) not in [11, 12]:
            return Response({
                'error': 'Please enter a valid Iranian mobile number'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Normalize phone to 09XXXXXXXXX format
        if phone_digits.startswith('989') and len(phone_digits) == 12:
            phone = '0' + phone_digits[2:]
        elif phone_digits.startswith('9') and len(phone_digits) == 10:
            phone = '0' + phone_digits
        else:
            phone = phone_digits

        # Get user
        try:
            user = Customer.objects.get(email=email, is_active=True)
        except Customer.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Update profile
        user.phone = phone
        user.company_name = company_name
        user.save(update_fields=['phone', 'company_name'])

        # Generate fresh tokens
        tokens = GoogleOAuthService.generate_tokens_for_user(user)

        # Return updated user data
        auth_serializer = AuthCustomerSerializer(user)

        logger.info(f"✅ Google user profile completed: {email}")

        return Response({
            'message': 'Profile completed successfully',
            'user': auth_serializer.data,
            'tokens': tokens
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"❌ Error completing Google profile: {str(e)}")
        return Response({
            'error': 'Failed to complete profile'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def link_google_account(request):
    """
    Link Google account to existing user
    """
    try:
        id_token_string = request.data.get('id_token')

        if not id_token_string:
            return Response({
                'error': 'Google ID token is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Verify Google ID token
        google_user_data, error = GoogleOAuthService.verify_google_id_token(id_token_string)

        if error:
            return Response({
                'error': error
            }, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        google_email = google_user_data['email']
        google_id = google_user_data.get('sub')

        # Check if Google email matches user email
        if user.email != google_email:
            return Response({
                'error': 'Google account email must match your account email'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if Google ID is already linked to another account
        if Customer.objects.filter(google_id=google_id).exclude(id=user.id).exists():
            return Response({
                'error': 'This Google account is already linked to another user'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Link Google account
        user.google_id = google_id
        user.save(update_fields=['google_id'])

        logger.info(f"✅ Google account linked to user: {user.email}")

        return Response({
            'message': 'Google account linked successfully',
            'user': AuthCustomerSerializer(user).data
        })

    except Exception as e:
        logger.error(f"❌ Error linking Google account: {str(e)}")
        return Response({
            'error': 'Failed to link Google account'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)