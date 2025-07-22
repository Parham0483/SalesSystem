from rest_framework import serializers

from .. import models
from ..models import Customer, Order, DealerCommission, OrderLog
from decimal import Decimal


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
                total=models.Sum('commission_amount')
            )['total']
            return float(total or 0)
        return 0

    def get_pending_commission(self, obj):
        """Calculate pending commission for dealer"""
        if obj.is_dealer:
            pending = obj.commissions.filter(is_paid=False).aggregate(
                total=models.Sum('commission_amount')
            )['total']
            return float(pending or 0)
        return 0


class DealerAssignmentSerializer(serializers.Serializer):
    """Serializer for assigning dealer to order"""
    dealer_id = serializers.IntegerField()
    dealer_notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    custom_commission_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, required=False,
        help_text="Custom commission rate for this order (overrides dealer default)"
    )

    def validate_dealer_id(self, value):
        try:
            dealer = Customer.objects.get(id=value, is_dealer=True, is_active=True)
            return value
        except Customer.DoesNotExist:
            raise serializers.ValidationError("Valid dealer not found")

    def validate_custom_commission_rate(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Commission rate must be between 0 and 100")
        return value


class DealerNotesUpdateSerializer(serializers.Serializer):
    """Serializer for updating dealer notes"""
    dealer_notes = serializers.CharField(max_length=1000, allow_blank=True)


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

