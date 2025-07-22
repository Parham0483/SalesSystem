# tasks/serializers/customers.py - SMART VERSION
from rest_framework import serializers
from ..models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    dealer_commission_rate = serializers.SerializerMethodField()

    # Dynamic fields based on context
    dealer_code = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'email', 'password', 'phone', 'company_name',
            'is_dealer', 'dealer_code', 'dealer_commission_rate',
            'date_joined'
        ]
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},
            'name': {'required': True},
            'date_joined': {'read_only': True}
        }

    def get_dealer_code(self, obj):
        """Only return dealer_code if user is a dealer or if admin is requesting"""
        request = self.context.get('request')

        # If it's the user themselves or an admin, show dealer_code
        if request and (request.user == obj or request.user.is_staff):
            return obj.dealer_code if obj.is_dealer else None

        # For other users, don't expose dealer codes
        return None

    def get_dealer_commission_rate(self, obj):
        """Only return commission rate for dealers and only to authorized users"""
        request = self.context.get('request')

        # Only show commission rate if:
        # 1. User is a dealer AND
        # 2. It's either the dealer themselves or an admin viewing
        if obj.is_dealer and request and (request.user == obj or request.user.is_staff):
            return float(obj.dealer_commission_rate)

        return None

    def to_representation(self, instance):
        """Customize the output based on context"""
        data = super().to_representation(instance)
        request = self.context.get('request')

        # If this is not a dealer, remove dealer-specific fields
        if not instance.is_dealer:
            data.pop('dealer_code', None)
            data.pop('dealer_commission_rate', None)

        # If user is not authorized to see dealer info, remove sensitive fields
        elif request and request.user != instance and not request.user.is_staff:
            data.pop('dealer_code', None)
            data.pop('dealer_commission_rate', None)

        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        customer = Customer.objects.create_user(
            password=password,
            **validated_data
        )
        return customer

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


# Separate lightweight serializer for authentication responses
class AuthCustomerSerializer(serializers.ModelSerializer):
    """Lightweight serializer for auth responses - only essential fields"""

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'email', 'is_staff', 'is_dealer',
            'company_name', 'dealer_code', 'dealer_commission_rate'
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        """Customize auth response based on user type"""
        data = super().to_representation(instance)

        # Always include is_dealer for routing decisions
        data['is_dealer'] = instance.is_dealer

        # Only include dealer-specific info for actual dealers
        if not instance.is_dealer:
            data['dealer_code'] = None
            data['dealer_commission_rate'] = None
        else:
            data['dealer_commission_rate'] = float(
                instance.dealer_commission_rate) if instance.dealer_commission_rate else 0.0

        return data