from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import make_password

from ..serializers import CustomerSerializer


@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    return JsonResponse({'detail': 'CSRF cookie set'})


@api_view(['POST'])
@permission_classes([AllowAny])
def customer_register(request):
    data = request.data.copy()
    if 'password' in data:
        data['password'] = make_password(data['password'])

    serializer = CustomerSerializer(data=data)
    if serializer.is_valid():
        customer = serializer.save()
        refresh = RefreshToken.for_user(customer)
        return Response({
            'message': 'Registration successful',
            'id': customer.id,
            'email': customer.email,
            'name': customer.name,
            'token': str(refresh.access_token),
            'refresh': str(refresh)
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def customer_login(request):
    email = request.data.get('email')
    password = request.data.get('password')

    if not email or not password:
        return Response({'error': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=email, password=password)

    if user is not None:
        refresh = RefreshToken.for_user(user)
        return Response({
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'is_staff': user.is_staff,
            'token': str(refresh.access_token),
            'refresh': str(refresh)
        })
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
