from rest_framework import serializers
from django.contrib.auth.hashers import check_password
from ..models import Customer


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile"""

    class Meta:
        model = Customer
        fields = ['name', 'phone', 'company_name']

    def validate_phone(self, value):
        """Validate phone number format"""
        if value:
            # Remove all non-digit characters
            import re
            phone_digits = re.sub(r'\D', '', str(value))

            # Check Iranian mobile number format
            if not phone_digits.startswith(('09', '989')):
                raise serializers.ValidationError("Please enter a valid Iranian mobile number")

            if len(phone_digits) not in [11, 12]:
                raise serializers.ValidationError("Phone number must be 11 or 12 digits")

        return value


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password"""
    current_password = serializers.CharField(required=True, min_length=1)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True, min_length=8)

    def validate(self, attrs):
        """Validate password change data"""
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("New passwords do not match")

        # Check password strength
        password = attrs['new_password']

        if len(password) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long")

        if not any(c.isalpha() for c in password):
            raise serializers.ValidationError("Password must contain at least one letter")

        if not any(c.isdigit() for c in password):
            raise serializers.ValidationError("Password must contain at least one number")

        return attrs

    def validate_current_password(self, value):
        """Verify current password"""
        user = self.context['request'].user
        if not check_password(value, user.password):
            raise serializers.ValidationError("Current password is incorrect")
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for password reset request"""
    email = serializers.EmailField(required=True)


class PasswordResetVerifySerializer(serializers.Serializer):
    """Serializer for OTP verification"""
    email = serializers.EmailField(required=True)
    otp = serializers.CharField(required=True, min_length=6, max_length=6)


class PasswordResetCompleteSerializer(serializers.Serializer):
    """Serializer for completing password reset"""
    email = serializers.EmailField(required=True)
    reset_token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)
    confirm_password = serializers.CharField(required=True, min_length=8)

    def validate(self, attrs):
        """Validate password reset completion"""
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords do not match")

        # Check password strength
        password = attrs['new_password']

        if len(password) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long")

        if not any(c.isalpha() for c in password):
            raise serializers.ValidationError("Password must contain at least one letter")

        if not any(c.isdigit() for c in password):
            raise serializers.ValidationError("Password must contain at least one number")

        return attrs