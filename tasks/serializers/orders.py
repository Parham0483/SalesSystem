from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from ..models import Order, OrderItem, Product, STATUS_CHOICES, Customer
from ..serializers.customers import CustomerInvoiceInfoUpdateSerializer

class OrderItemCreateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(source='requested_quantity', min_value=1)
    customer_notes = serializers.CharField(required=False, allow_blank=True)

    def validate_product_id(self, value):
        try:
            product = Product.objects.get(id=value)
            if not product.is_active:
                raise serializers.ValidationError("This product is inactive.")
            return value
        except Product.DoesNotExist:
            raise serializers.ValidationError("Product not found.")



class CustomerInfoForOfficialInvoiceSerializer(serializers.Serializer):
    """Serializer for collecting customer info required for official invoices"""

    # Basic info (always required)
    name = serializers.CharField(max_length=100, required=True)
    phone = serializers.CharField(max_length=15, required=True)
    company_name = serializers.CharField(max_length=100, required=False, allow_blank=True)

    # Official invoice required fields
    national_id = serializers.CharField(max_length=20, required=True)
    complete_address = serializers.CharField(required=True)
    postal_code = serializers.CharField(max_length=10, required=True)

    # Optional fields
    economic_id = serializers.CharField(max_length=20, required=False, allow_blank=True)
    city = serializers.CharField(max_length=50, required=False, allow_blank=True)
    province = serializers.CharField(max_length=50, required=False, allow_blank=True)
    business_type = serializers.ChoiceField(
        choices=[('individual', 'شخص حقیقی'), ('company', 'شخص حقوقی')],
        default='individual'
    )

    def validate_postal_code(self, value):
        """Validate postal code format"""
        if value and not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError("کد پستی باید 10 رقم باشد")
        return value

    def validate_national_id(self, value):
        """Basic validation for national ID"""
        if value and (not value.isdigit() or len(value) < 8 or len(value) > 12):
            raise serializers.ValidationError("شناسه ملی معتبر وارد کنید")
        return value


class OrderItemSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())


    class Meta:
        model = OrderItem
        fields = ['product', 'requested_quantity', 'customer_notes']


class OrderCreateSerializer(serializers.Serializer):
    items = OrderItemCreateSerializer(many=True, min_length=1)
    business_invoice_type = serializers.ChoiceField(
        choices=Order.BUSINESS_INVOICE_TYPE_CHOICES,
        default='unofficial'
    )
    customer_comment = serializers.CharField(required=False, allow_blank=True)
    customer_info = CustomerInfoForOfficialInvoiceSerializer(required=False)

    def validate(self, data):
        # First, check the invoice type from the incoming data.
        invoice_type = data.get('business_invoice_type')

        # If the order is unofficial, remove customer_info to prevent validation.
        if invoice_type == 'unofficial':
            if 'customer_info' in data:
                data.pop('customer_info')
            return data

        # If the order is official, proceed with the original validation.
        if not data.get('customer_info'):
            raise serializers.ValidationError({
                'customer_info': 'Customer information is required for an official invoice.'
            })

        # Let DRF handle the nested validation for the official case now.
        return data

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        customer_info_data = validated_data.pop('customer_info', None)
        customer = self.context['request'].user
        invoice_type = validated_data.get('business_invoice_type')

        # Update customer info if provided
        if invoice_type == 'official' and customer_info_data:
            # Use the serializer to validate the incoming data
            customer_serializer = CustomerInvoiceInfoUpdateSerializer(instance=customer, data=customer_info_data,
                                                                      partial=True)
            customer_serializer.is_valid(raise_exception=True)

            # --- FIX: Manually update the customer instead of calling .save() on the serializer ---
            for field, value in customer_serializer.validated_data.items():
                setattr(customer, field, value)
            customer.save()
            # --- END FIX ---

        # Validate customer for official invoice AFTER potential update
        if validated_data.get('business_invoice_type') == 'official':
            is_valid, missing_fields = customer.validate_for_official_invoice()
            if not is_valid:
                raise serializers.ValidationError({
                    'customer_info': f"Required fields are incomplete: {', '.join(missing_fields)}"
                })

        # Create the Order instance
        order = Order.objects.create(customer=customer, **validated_data)

        # Create OrderItem instances
        for item_data in items_data:
            OrderItem.objects.create(
                order=order,
                product_id=item_data['product_id'],
                requested_quantity=item_data['requested_quantity'],
                customer_notes=item_data.get('customer_notes', '')
            )

        customer.update_last_order_date()
        return order

class OrderSerializer(serializers.ModelSerializer):
    """Full order serializer for read operations"""

    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    items_count = serializers.IntegerField(source='items.count', read_only=True)

    # Customer official invoice info
    customer_has_official_info = serializers.SerializerMethodField()
    customer_missing_fields = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'order_number', 'customer', 'customer_name', 'customer_phone',
            'business_invoice_type', 'status', 'total_amount', 'notes',
            'created_at', 'updated_at', 'items_count',
            'customer_has_official_info', 'customer_missing_fields'
        ]
        read_only_fields = ['id', 'order_number', 'total_amount', 'created_at', 'updated_at']

    def get_customer_has_official_info(self, obj):
        """Check if customer has all required info for official invoice"""
        is_valid, _ = obj.customer.validate_for_official_invoice()
        return is_valid

    def get_customer_missing_fields(self, obj):
        """Get list of missing fields for official invoice"""
        is_valid, missing_fields = obj.customer.validate_for_official_invoice()
        return missing_fields if not is_valid else []


class OrderItemSerializer(serializers.ModelSerializer):
    """Order item serializer"""

    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)
    product_unit = serializers.CharField(source='product.unit', read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name', 'product_code', 'product_unit',
            'quantity', 'unit_price', 'total_price'
        ]


class OrderDetailSerializer(OrderSerializer):
    """Detailed order serializer with items"""

    items = OrderItemSerializer(many=True, read_only=True)

    # Customer details for official invoices
    customer_details = serializers.SerializerMethodField()

    class Meta(OrderSerializer.Meta):
        fields = OrderSerializer.Meta.fields + ['items', 'customer_details']

    def get_customer_details(self, obj):
        """Get customer details needed for invoice generation"""
        customer = obj.customer
        return {
            'name': customer.name,
            'phone': customer.phone,
            'company_name': customer.company_name,
            'national_id': customer.national_id,
            'economic_id': customer.economic_id,
            'complete_address': customer.complete_address,
            'postal_code': customer.postal_code,
            'city': customer.city,
            'province': customer.province,
            'business_type': customer.business_type,
            'full_address': customer.get_full_address(),
            'display_name': customer.get_display_name(),
        }

class OrderItemAdminUpdateSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    id = serializers.IntegerField()
    quoted_unit_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    final_quantity = serializers.IntegerField(required=False, allow_null=True)
    admin_notes = serializers.CharField(allow_blank=True, required=False)

    #TAX-RELATED FIELDS:
    product_tax_rate = serializers.DecimalField(source='product.tax_rate', read_only=True, max_digits=5,
                                                decimal_places=2)
    unit_tax_amount = serializers.SerializerMethodField()
    total_tax_amount = serializers.SerializerMethodField()
    subtotal = serializers.SerializerMethodField()
    total_with_tax = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product', 'product_name', 'requested_quantity',
            'quoted_unit_price', 'final_quantity', 'customer_notes', 'admin_notes',
            'product_tax_rate', 'unit_tax_amount','total_tax_amount',
            'subtotal', 'total_with_tax'
        ]
        read_only_fields = ['product', 'requested_quantity', 'customer_notes', 'product_name']

    def get_unit_tax_amount(self, obj):
        """Calculate tax amount per unit"""
        if obj.quoted_unit_price and obj.product.tax_rate:
            return float(obj.quoted_unit_price * (obj.product.tax_rate / 100))
        return 0.0

    def get_total_tax_amount(self, obj):
        """Calculate total tax amount for this item"""
        if obj.quoted_unit_price and obj.final_quantity and obj.product.tax_rate:
            subtotal = obj.quoted_unit_price * obj.final_quantity
            return float(subtotal * (obj.product.tax_rate / 100))
        return 0.0

    def get_subtotal(self, obj):
        """Calculate subtotal without tax"""
        if obj.quoted_unit_price and obj.final_quantity:
            return float(obj.quoted_unit_price * obj.final_quantity)
        return 0.0

    def get_total_with_tax(self, obj):
        """Calculate total including tax for this item"""
        if obj.quoted_unit_price and obj.final_quantity:
            subtotal = obj.quoted_unit_price * obj.final_quantity
            if obj.product.tax_rate:
                tax_amount = subtotal * (obj.product.tax_rate / 100)
                return float(subtotal + tax_amount)
            return float(subtotal)
        return 0.0

class OrderAdminUpdateSerializer(serializers.ModelSerializer):
    items = OrderItemAdminUpdateSerializer(many=True)
    status = serializers.ChoiceField(choices=STATUS_CHOICES, read_only=True)
    admin_comment = serializers.CharField(allow_blank=True, required=False)
    pricing_date = serializers.DateTimeField(read_only=True)
    quoted_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    business_invoice_type = serializers.ChoiceField(
        choices=Order.BUSINESS_INVOICE_TYPE_CHOICES,
        required=False,
        help_text="Business type of invoice - Official or Unofficial"
    )

    class Meta:
        model = Order
        fields = ['id', 'status', 'admin_comment', 'pricing_date', 'quoted_total', 'items', 'business_invoice_type']
        read_only_fields = ['id', 'status', 'pricing_date', 'quoted_total']

    def validate_items(self, value):
        """Validate that at least one item has pricing"""
        if not value:
            raise serializers.ValidationError("At least one item is required")

        # Check if at least one item has valid pricing
        has_valid_pricing = False
        for item_data in value:
            quoted_price = item_data.get('quoted_unit_price')
            final_qty = item_data.get('final_quantity')

            if quoted_price is not None and final_qty is not None:
                if float(quoted_price) > 0 and int(final_qty) > 0:
                    has_valid_pricing = True
                    break

        if not has_valid_pricing:
            raise serializers.ValidationError(
                "At least one item must have valid pricing (quoted_unit_price > 0 and final_quantity > 0)"
            )

        return value

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', [])
        admin_comment = validated_data.get('admin_comment')

        if 'business_invoice_type' in validated_data:
            old_type = instance.get_business_invoice_type_display()
            instance.business_invoice_type = validated_data['business_invoice_type']
            new_type = instance.get_business_invoice_type_display()
            print(f"Order #{instance.id} business invoice type: {old_type} → {new_type}")

        # CRITICAL: Check that order is in correct status for pricing
        if instance.status != 'pending_pricing':
            raise serializers.ValidationError(
                f"Cannot update pricing for order with status: {instance.status}"
            )

        with transaction.atomic():
            # Update admin comment if provided
            if admin_comment is not None:
                instance.admin_comment = admin_comment

            # Create a mapping of existing items by ID
            item_mapping = {item.id: item for item in instance.items.all()}

            # Update each order item
            for item_data in items_data:
                item_id = item_data.get('id')
                if not item_id:
                    continue

                item = item_mapping.get(item_id)
                if not item:
                    continue

                # Update the item fields
                for attr, value in item_data.items():
                    if attr == 'id':
                        continue

                    if attr == 'quoted_unit_price' and value is not None:
                        # Convert to Decimal and validate
                        decimal_value = Decimal(str(value))
                        if decimal_value < 0:
                            raise serializers.ValidationError(f"Price cannot be negative for item {item_id}")
                        item.quoted_unit_price = decimal_value
                    elif attr == 'final_quantity' and value is not None:
                        # Validate quantity
                        int_value = int(value)
                        if int_value < 0:
                            raise serializers.ValidationError(f"Quantity cannot be negative for item {item_id}")
                        item.final_quantity = int_value
                    elif attr == 'admin_notes':
                        item.admin_notes = value or ''

                # Save the updated item
                item.save()

            # Calculate total for items with pricing
            total = Decimal('0.00')
            priced_items_count = 0

            # Refresh items from database to get updated values
            for item in instance.items.all():
                if item.quoted_unit_price and item.final_quantity:
                    item_total = Decimal(str(item.quoted_unit_price)) * Decimal(str(item.final_quantity))
                    total += item_total
                    priced_items_count += 1

            # CRITICAL: Only update status if we have valid pricing
            if priced_items_count > 0 and total > 0:
                # Update order with pricing information
                instance.pricing_date = timezone.now()
                instance.quoted_total = total
                instance.status = 'waiting_customer_approval'
                instance.priced_by = self.context['request'].user

                # Save the instance
                instance.save(update_fields=[
                    'admin_comment', 'pricing_date', 'quoted_total',
                    'status', 'priced_by'
                ])

                print(f"✅ Order {instance.id} pricing updated:")
                print(f"   - Total: {total}")
                print(f"   - Status: {instance.status}")
                print(f"   - Priced items: {priced_items_count}")
            else:
                raise serializers.ValidationError(
                    "Cannot submit pricing: No valid items with price and quantity"
                )

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
    business_invoice_type_display = serializers.CharField(source='get_business_invoice_type_display', read_only=True)
    is_official_invoice = serializers.BooleanField(read_only=True)
    invoice_id = serializers.SerializerMethodField()
    invoice_number = serializers.SerializerMethodField()
    invoice_date = serializers.SerializerMethodField()

    has_payment_receipts = serializers.BooleanField(read_only=True)
    payment_receipts_count = serializers.SerializerMethodField()

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
            'invoice_id', 'invoice_number', 'invoice_date',
            'business_invoice_type', 'business_invoice_type_display', 'is_official_invoice',

            # Payment fields
            'payment_receipt', 'payment_receipt_uploaded_at',
            'payment_verified', 'payment_verified_at', 'payment_notes',
            'has_payment_receipts', 'payment_receipts_count',
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

    def get_payment_receipts_count(self, obj):
        """Get count of payment receipts"""
        try:
            return obj.all_payment_receipts.count() if hasattr(obj, 'all_payment_receipts') else 0
        except:
            return 0