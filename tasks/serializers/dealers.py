
from rest_framework import serializers
from django.db.models import Sum
from decimal import Decimal
from ..models import Customer, Order, DealerCommission, OrderLog


class DealerSerializer(serializers.ModelSerializer):
    """Serializer for dealer information"""
    assigned_orders_count = serializers.ReadOnlyField()
    total_commission_earned = serializers.SerializerMethodField()
    pending_commission = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'email', 'phone', 'company_name',
            'is_dealer', 'dealer_code', 'dealer_commission_rate',
            'assigned_orders_count', 'total_commission_earned',
            'pending_commission', 'date_joined'
        ]
        read_only_fields = ['id', 'dealer_code', 'date_joined']

    def get_total_commission_earned(self, obj):
        """Calculate total commission earned by dealer"""
        if obj.is_dealer:
            total = obj.commissions.filter(is_paid=True).aggregate(
                total=Sum('commission_amount')
            )['total']
            return float(total or 0)
        return 0

    def get_pending_commission(self, obj):
        """Calculate pending commission for dealer"""
        if obj.is_dealer:
            pending = obj.commissions.filter(is_paid=False).aggregate(
                total=Sum('commission_amount')
            )['total']
            return float(pending or 0)
        return 0


class DealerAssignmentSerializer(serializers.Serializer):
    """Serializer for assigning dealer to order - FIXED VERSION"""
    dealer_id = serializers.IntegerField(required=True)
    dealer_notes = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=1000,
        default=''
    )

    def validate_dealer_id(self, value):
        """Validate that the dealer exists and is active"""
        if not value:
            raise serializers.ValidationError("Dealer ID is required")

        try:
            dealer = Customer.objects.get(
                id=value,
                is_dealer=True,
                is_active=True
            )
            # Store the dealer object for use in the view
            self.context['dealer'] = dealer
            return value
        except Customer.DoesNotExist:
            raise serializers.ValidationError(
                "Valid active dealer not found with this ID"
            )

    def validate(self, attrs):
        """Additional validation"""
        dealer_id = attrs.get('dealer_id')

        # Check if order context is provided
        order = self.context.get('order')
        if order and order.assigned_dealer:
            if order.assigned_dealer.id == dealer_id:
                raise serializers.ValidationError(
                    "This dealer is already assigned to this order"
                )

        return attrs


class DealerNotesUpdateSerializer(serializers.Serializer):
    """Serializer for updating dealer notes"""
    dealer_notes = serializers.CharField(
        max_length=1000,
        allow_blank=True,
        required=False,
        default=''
    )


class DealerCommissionSerializer(serializers.ModelSerializer):
    """Serializer for dealer commission tracking"""
    dealer_name = serializers.CharField(source='dealer.name', read_only=True)
    dealer_email = serializers.CharField(source='dealer.email', read_only=True)
    order_customer = serializers.CharField(source='order.customer.name', read_only=True)

    class Meta:
        model = DealerCommission
        fields = [
            'id', 'dealer_name', 'dealer_email', 'order', 'order_customer',
            'commission_rate', 'commission_amount', 'order_total',
            'is_paid', 'paid_at', 'payment_reference', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']