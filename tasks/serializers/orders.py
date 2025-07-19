# Update your tasks/serializers/orders.py

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from ..models import Order, OrderItem, Product, STATUS_CHOICES


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
            # FIX: Add customer to the order creation
            order = Order.objects.create(
                customer=customer,  # <- This was missing!
                **validated_data
            )
            for item_data in items_data:
                OrderItem.objects.create(
                    order=order,
                    product=item_data['product'],
                    requested_quantity=item_data['requested_quantity'],
                    customer_notes=item_data.get('customer_notes', '')  # Use .get() to avoid KeyError
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
        read_only_fields = ['id', 'status', 'pricing_date', 'quoted_total','priced_by']

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
                            setattr(item, attr, value)
                    item.save()

            # Automatically set pricing_date, quoted_total, and status
            instance.pricing_date = timezone.now()
            instance.quoted_total = sum(
                (item.quoted_unit_price or 0) * (item.final_quantity or 0)
                for item in instance.items.all()
            )
            instance.status = 'waiting_customer_approval'
            instance.priced_by = self.context['request'].user
            instance.save()

        return instance


class OrderDetailSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    items = OrderItemAdminUpdateSerializer(many=True)

    class Meta:
        model = Order
        fields = [
            'id', 'customer', 'customer_name', 'status', 'customer_comment',
            'admin_comment', 'pricing_date', 'quoted_total', 'items',
            'created_at', 'updated_at'
        ]
        read_only_fields = fields