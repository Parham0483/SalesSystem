# tasks/serializers/orders.py - Updated with customer phone field

from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from ..models import Order, OrderItem, Product, STATUS_CHOICES, Customer


class OrderItemSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())

    class Meta:
        model = OrderItem
        fields = ['product', 'requested_quantity', 'customer_notes']


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ['id', 'customer_comment', 'items']
        read_only_fields = ['id']

    def create(self, validated_data):
        request = self.context.get('request')
        customer = request.user
        items_data = validated_data.pop('items')

        with transaction.atomic():
            order = Order.objects.create(
                customer=customer,
                **validated_data
            )
            for item_data in items_data:
                OrderItem.objects.create(
                    order=order,
                    product=item_data['product'],
                    requested_quantity=item_data['requested_quantity'],
                    customer_notes=item_data.get('customer_notes', '')
                )
        return order


class OrderItemAdminUpdateSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    id = serializers.IntegerField()
    quoted_unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    final_quantity = serializers.IntegerField()
    admin_notes = serializers.CharField(allow_blank=True, required=False)

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name', 'requested_quantity',
            'quoted_unit_price', 'final_quantity', 'customer_notes', 'admin_notes'
        ]
        read_only_fields = ['product', 'requested_quantity', 'customer_notes', 'product_name']


class OrderAdminUpdateSerializer(serializers.ModelSerializer):
    items = OrderItemAdminUpdateSerializer(many=True)
    status = serializers.ChoiceField(choices=STATUS_CHOICES, read_only=True)
    admin_comment = serializers.CharField(allow_blank=True, required=False)
    pricing_date = serializers.DateTimeField(read_only=True)
    quoted_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'status', 'admin_comment', 'pricing_date', 'quoted_total', 'items']
        read_only_fields = ['id', 'status', 'pricing_date', 'quoted_total', 'priced_by']

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', [])
        admin_comment = validated_data.get('admin_comment')

        with transaction.atomic():
            if admin_comment is not None:
                instance.admin_comment = admin_comment

            # Update each order item
            item_mapping = {item.id: item for item in instance.items.all()}
            for item_data in items_data:
                item = item_mapping.get(item_data['id'])
                if item:
                    for attr, value in item_data.items():
                        if attr != 'id':
                            if attr == 'quoted_unit_price' and value is not None:
                                value = Decimal(str(value))
                            setattr(item, attr, value)
                    item.save()

            # Calculate totals
            instance.pricing_date = timezone.now()
            total = Decimal('0.00')
            for item in instance.items.all():
                if item.quoted_unit_price and item.final_quantity:
                    total += Decimal(str(item.quoted_unit_price)) * Decimal(str(item.final_quantity))

            instance.quoted_total = total
            instance.status = 'waiting_customer_approval'
            instance.priced_by = self.context['request'].user
            instance.save()

        return instance


class OrderDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)

    # ENHANCED: Pricing information
    priced_by_name = serializers.CharField(source='priced_by.name', read_only=True)
    priced_by_email = serializers.CharField(source='priced_by.email', read_only=True)

    # ENHANCED: Dealer fields with commission details
    assigned_dealer_name = serializers.CharField(source='assigned_dealer.name', read_only=True)
    assigned_dealer_email = serializers.CharField(source='assigned_dealer.email', read_only=True)
    assigned_dealer_id = serializers.IntegerField(source='assigned_dealer.id', read_only=True)
    assigned_dealer_code = serializers.CharField(source='assigned_dealer.dealer_code', read_only=True)

    # Commission information
    dealer_commission_amount = serializers.ReadOnlyField()
    effective_commission_rate = serializers.ReadOnlyField()
    has_custom_commission = serializers.SerializerMethodField()
    dealer_default_rate = serializers.SerializerMethodField()

    has_dealer = serializers.ReadOnlyField()

    items = OrderItemAdminUpdateSerializer(many=True)

    # Invoice fields
    invoice_id = serializers.SerializerMethodField()
    invoice_number = serializers.SerializerMethodField()
    invoice_date = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'customer', 'customer_name', 'customer_phone', 'status', 'customer_comment',
            'admin_comment', 'pricing_date', 'quoted_total', 'items',
            'created_at', 'updated_at', 'completion_date', 'completed_by',
            'customer_response_date', 'customer_rejection_reason',

            # ENHANCED: Pricing info
            'priced_by_name', 'priced_by_email',

            # ENHANCED: Dealer fields with commission
            'assigned_dealer_name', 'assigned_dealer_email', 'assigned_dealer_id',
            'assigned_dealer_code', 'dealer_assigned_at', 'dealer_notes',
            'dealer_commission_amount', 'effective_commission_rate',
            'has_custom_commission', 'dealer_default_rate',
            'custom_commission_rate', 'has_dealer',

            # Invoice
            'invoice_id', 'invoice_number', 'invoice_date','payment_receipt',
            'payment_receipt_uploaded_at',
            'payment_verified',
            'payment_verified_at',
            'payment_notes',
        ]
        read_only_fields = fields

    def get_has_custom_commission(self, obj):
        """Check if this order has a custom commission rate"""
        return obj.custom_commission_rate is not None

    def get_dealer_default_rate(self, obj):
        """Get dealer's default commission rate"""
        if obj.assigned_dealer:
            return float(obj.assigned_dealer.dealer_commission_rate)
        return None

    def get_invoice_id(self, obj):
        if hasattr(obj, 'invoice'):
            return obj.invoice.id
        return None

    def get_invoice_number(self, obj):
        if hasattr(obj, 'invoice'):
            return obj.invoice.invoice_number
        return None

    def get_invoice_date(self, obj):
        if hasattr(obj, 'invoice'):
            return obj.invoice.issued_at
        return None