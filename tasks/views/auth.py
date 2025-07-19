from django.contrib.auth import authenticate, login
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone

from ..serializers import CustomerSerializer
from ..models import Customer


@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    return JsonResponse({'detail': 'CSRF cookie set'})


@api_view(['POST'])
@permission_classes([AllowAny])
def customer_register(request):
    try:
        data = request.data.copy()

        # Check if user already exists
        if Customer.objects.filter(email=data.get('email')).exists():
            return Response({
                'error': 'User with this email already exists'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Create customer using the serializer
        serializer = CustomerSerializer(data=data)
        if serializer.is_valid():
            customer = serializer.save()

            # Generate tokens
            refresh = RefreshToken.for_user(customer)

            return Response({
                'message': 'Registration successful',
                'user': {
                    'id': customer.id,
                    'email': customer.email,
                    'name': customer.name,
                    'is_staff': customer.is_staff
                },
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh)
                }
            }, status=status.HTTP_201_CREATED)

        return Response({
            'error': 'Invalid data',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        return Response({
            'error': f'Registration failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def customer_login(request):
    try:
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response({
                'error': 'Email and password are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Authenticate user
        user = authenticate(request, username=email, password=password)

        if user is not None:
            if not user.is_active:
                return Response({
                    'error': 'Account is deactivated'
                }, status=status.HTTP_401_UNAUTHORIZED)

            # Update last login
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])

            # Generate tokens
            refresh = RefreshToken.for_user(user)

            return Response({
                'message': 'Login successful',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.name,
                    'is_staff': user.is_staff,
                    'company_name': user.company_name
                },
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh)
                }
            }, status=status.HTTP_200_OK)

        return Response({
            'error': 'Invalid email or password'
        }, status=status.HTTP_401_UNAUTHORIZED)

    except Exception as e:
        return Response({
            'error': f'Login failed: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def customer_logout(request):
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()

        return Response({
            'message': 'Successfully logged out'
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'error': f'Logout failed: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)