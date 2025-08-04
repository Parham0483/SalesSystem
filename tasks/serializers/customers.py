from rest_framework import serializers
from ..models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    dealer_commission_rate = serializers.SerializerMethodField()
    dealer_code = serializers.SerializerMethodField()

    # Add these as SerializerMethodField (not model fields)
    total_orders = serializers.SerializerMethodField()
    total_spent = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'email', 'password', 'phone', 'company_name',
            'is_active',
            'is_staff',
            'is_dealer', 'dealer_code', 'dealer_commission_rate',
            'date_joined', 'last_login',
            'total_orders', 'total_spent'
        ]
        extra_kwargs = {
            'password': {'write_only': True,'required': True,
                'min_length': 8,},
            'email': {'required': True},
            'name': {'required': True},
            'date_joined': {'read_only': True},
            'last_login': {'read_only': True},
        }

    def validate_password(self, value):
        """Validate password strength"""
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long")

        # Check for at least one letter and one number
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError("Password must contain at least one letter")

        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError("Password must contain at least one number")

        return value

    def validate_email(self, value):
        """Validate email uniqueness"""
        if self.instance:
            # Update case - exclude current instance
            if Customer.objects.filter(email=value).exclude(id=self.instance.id).exists():
                raise serializers.ValidationError("A customer with this email already exists")
        else:
            # Create case
            if Customer.objects.filter(email=value).exists():
                raise serializers.ValidationError("A customer with this email already exists")
        return value

    def create(self, validated_data):
        """Create customer with required password"""
        password = validated_data.pop('password')

        try:
            customer = Customer.objects.create_user(
                password=password,
                **validated_data
            )
            return customer
        except Exception as e:
            raise serializers.ValidationError(f"Error creating customer: {str(e)}")


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

        if obj.is_dealer and request and (request.user == obj or request.user.is_staff):
            return float(obj.dealer_commission_rate)

        return None

    def get_total_orders(self, obj):
        """Get total orders count"""
        try:
            if obj.is_dealer:
                # For dealers, count assigned orders
                return obj.assigned_orders.count()
            else:
                # For regular customers, count their orders
                return obj.order_set.count()
        except Exception:
            return 0

    def get_total_spent(self, obj):
        """Get total amount spent by customer"""
        try:
            if not obj.is_dealer:
                from django.db.models import Sum
                total = obj.order_set.filter(
                    status='completed'
                ).aggregate(total=Sum('quoted_total'))['total']
                return float(total or 0)
            return 0
        except Exception:
            return 0

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


class CustomerInvoiceInfoSerializer(serializers.ModelSerializer):
    """Serializer for customer invoice information"""

    class Meta:
        model = Customer
        fields = [
            'name', 'phone', 'company_name', 'email',
            'national_id', 'economic_id', 'postal_code', 'complete_address'
        ]

    def validate_national_id(self, value):
        """Validate national ID format (basic validation)"""
        if value and len(value) not in [8, 10]:
            raise serializers.ValidationError("شناسه ملی باید 8 یا 10 رقم باشد")
        return value

    def validate_postal_code(self, value):
        """Validate postal code format"""
        if value and (not value.isdigit() or len(value) != 10):
            raise serializers.ValidationError("کد پستی باید 10 رقم باشد")
        return value


class CustomerInvoiceInfoUpdateSerializer(serializers.Serializer):
    """Serializer for updating customer info during order creation"""

    # Basic info (always required)
    name = serializers.CharField(max_length=100, required=False)
    phone = serializers.CharField(max_length=15, required=False)
    company_name = serializers.CharField(max_length=100, required=False, allow_blank=True)

    # Official invoice fields (required only for official invoices)
    national_id = serializers.CharField(max_length=20, required=False, allow_blank=True)
    economic_id = serializers.CharField(max_length=20, required=False, allow_blank=True)
    postal_code = serializers.CharField(max_length=10, required=False, allow_blank=True)
    complete_address = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        """Custom validation based on invoice type"""
        invoice_type = self.context.get('invoice_type', 'unofficial')

        if invoice_type == 'official':
            required_fields = ['national_id', 'complete_address', 'postal_code']
            missing_fields = []

            for field in required_fields:
                if not data.get(field):
                    missing_fields.append(field)

            if missing_fields:
                field_names = {
                    'national_id': 'شناسه ملی',
                    'complete_address': 'آدرس کامل',
                    'postal_code': 'کد پستی'
                }
                missing_names = [field_names[field] for field in missing_fields]
                raise serializers.ValidationError(
                    f"برای فاکتور رسمی این فیلدها الزامی است: {', '.join(missing_names)}"
                )

        return data