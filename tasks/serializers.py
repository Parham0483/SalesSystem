from django.db import transaction
from rest_framework import serializers
from .models import Customer, Product, Order, OrderItem, Invoice, Payment


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'email', 'password', 'phone', 'company_name']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        password = validated_data.pop('password')
        customer = Customer(**validated_data)
        customer.set_password(password)  # hashes the password
        customer.save()
        return customer



class ProductSerializer(serializers.ModelSerializer):

    class Meta:
        model = Product
        fields = '__all__'


class OrderItemSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())

    class Meta:
        model = OrderItem
        fields = ['product', 'requested_quantity', 'customer_notes']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ['id', 'customer', 'status', 'customer_comment', 'items', 'created_at', 'updated_at']
        read_only_fields = ['customer', 'status', 'created_at', 'updated_at']

    def create(self, validated_data):
        request = self.context.get('request')
        customer = request.user
        items_data = validated_data.pop('items')

        with transaction.atomic():
            order = Order.objects.create(customer=customer, **validated_data)
            for item_data in items_data:
                product = item_data['product']
                OrderItem.objects.create(order=order, product=product,
                                         requested_quantity=item_data['requested_quantity'],
                                         customer_notes=item_data['customer_notes'])
        return order



class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'