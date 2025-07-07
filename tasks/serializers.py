# tasks/serializers.py
from rest_framework import serializers
from .models import Customer, Product, Order, OrderItem, Invoice, Wallet, Payment

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    class Meta:
        model = OrderItem
        fields = '__all__'

class OrderSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    class Meta:
        model = Order
        fields = '__all__'

class InvoiceSerializer(serializers.ModelSerializer):
    order = OrderSerializer(read_only=True)
    class Meta:
        model = Invoice
        fields = '__all__'

class WalletSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)
    class Meta:
        model = Wallet
        fields = '__all__'

class PaymentSerializer(serializers.ModelSerializer):
    invoice = InvoiceSerializer(read_only=True)
    class Meta:
        model = Payment
        fields = '__all__'
