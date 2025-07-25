from rest_framework import serializers
from django.utils import timezone
from ..models import Product, ProductCategory, ProductImage, ShipmentAnnouncement


class ProductImageSerializer(serializers.ModelSerializer):
    """Serializer for additional product images"""

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'alt_text', 'order', 'is_primary']


class ProductCategorySerializer(serializers.ModelSerializer):
    """Serializer for product categories"""
    products_count = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductCategory
        fields = [
            'id', 'name', 'name_fa', 'display_name', 'description',
            'slug', 'is_active', 'order', 'products_count'
        ]

    def get_products_count(self, obj):
        return obj.products.filter(is_active=True).count()

    def get_display_name(self, obj):
        return obj.name_fa if obj.name_fa else obj.name


class ProductSerializer(serializers.ModelSerializer):
    """Enhanced product serializer matching your model structure"""
    image_url = serializers.SerializerMethodField()
    stock_status = serializers.ReadOnlyField()  # Use model property
    is_out_of_stock = serializers.ReadOnlyField()  # Use model property
    category_name = serializers.ReadOnlyField()  # Use model property
    category_details = serializers.SerializerMethodField()
    days_since_created = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'base_price', 'stock', 'sku',
            'weight', 'image', 'image_url',
            'category', 'category_name', 'category_details',
            'is_active', 'is_featured', 'created_at', 'updated_at',
            'meta_title', 'meta_description', 'tags',
            'stock_status', 'is_out_of_stock', 'days_since_created'
        ]
        read_only_fields = ['created_at', 'updated_at', 'stock_status', 'is_out_of_stock', 'category_name']

    def get_image_url(self, obj):
        """Get the primary image URL with full domain"""
        request = self.context.get('request')

        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            else:
                # Fallback - hardcode your backend URL if no request context
                from django.conf import settings
                base_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000')
                return f"{base_url}{obj.image.url}"

        # Use the model's method if no direct image
        image_url = obj.get_primary_image_url()
        if image_url and request:
            return request.build_absolute_uri(image_url)
        elif image_url:
            from django.conf import settings
            base_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000')
            return f"{base_url}{image_url}"

        return None

    def get_category_details(self, obj):
        """Get category details"""
        if obj.category:
            return {
                'id': obj.category.id,
                'name': obj.category.name,
                'name_fa': obj.category.name_fa,
                'display_name': obj.category.display_name
            }
        return None

    def get_days_since_created(self, obj):
        """Get days since product was created"""
        return (timezone.now() - obj.created_at).days

    def create(self, validated_data):
        """Create product with automatic SKU generation if needed"""
        if not validated_data.get('sku'):
            # Generate SKU automatically
            sku = f"PRD-{timezone.now().strftime('%Y%m%d')}-{Product.objects.count() + 1:04d}"
            validated_data['sku'] = sku

        return super().create(validated_data)

    def validate_stock(self, value):
        """Validate stock value"""
        if value < 0:
            raise serializers.ValidationError("Stock cannot be negative")
        return value

    def validate_base_price(self, value):
        """Validate base price"""
        if value < 0:
            raise serializers.ValidationError("Price cannot be negative")
        return value

    def validate_category(self, value):
        """Validate category exists and is active"""
        if value and not value.is_active:
            raise serializers.ValidationError("Selected category is not active")
        return value


class ShipmentAnnouncementSerializer(serializers.ModelSerializer):
    """Serializer for shipment announcements"""
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    image_url = serializers.SerializerMethodField()
    products_count = serializers.ReadOnlyField()
    related_products_info = serializers.SerializerMethodField()

    class Meta:
        model = ShipmentAnnouncement
        fields = [
            'id', 'title', 'description', 'image', 'image_url',
            'created_at', 'created_by', 'created_by_name',
            'is_active', 'is_featured', 'products_count',
            'related_products', 'related_products_info'
        ]
        read_only_fields = ['created_at', 'created_by', 'products_count']

    def get_image_url(self, obj):
        return obj.get_image_url()

    def get_related_products_info(self, obj):
        """Get basic info about related products"""
        products = obj.related_products.filter(is_active=True)[:5]  # Limit to 5
        return [
            {
                'id': product.id,
                'name': product.name,
                'image_url': product.get_primary_image_url(),
                'base_price': product.base_price,
                'stock': product.stock,
                'stock_status': product.stock_status
            }
            for product in products
        ]


class ProductStockUpdateSerializer(serializers.Serializer):
    """Serializer for stock updates"""
    stock = serializers.IntegerField(min_value=0)

    def validate_stock(self, value):
        if value < 0:
            raise serializers.ValidationError("Stock cannot be negative")
        return value


class ProductSearchSerializer(serializers.Serializer):
    """Serializer for product search parameters"""
    q = serializers.CharField(required=False, max_length=200)
    category = serializers.IntegerField(required=False)
    min_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=0)
    max_price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=0)
    in_stock_only = serializers.BooleanField(default=False)
    sort_by = serializers.ChoiceField(
        choices=[
            ('name', 'Name'),
            ('-name', 'Name (desc)'),
            ('base_price', 'Price (low to high)'),
            ('-base_price', 'Price (high to low)'),
            ('created_at', 'Oldest first'),
            ('-created_at', 'Newest first'),
            ('stock', 'Stock (low to high)'),
            ('-stock', 'Stock (high to low)')
        ],
        default='-created_at'
    )


class ProductBulkUpdateSerializer(serializers.Serializer):
    """Serializer for bulk product updates"""
    product_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    action = serializers.ChoiceField(choices=[
        ('activate', 'Activate'),
        ('deactivate', 'Deactivate'),
        ('update_category', 'Update Category'),
        ('update_stock', 'Update Stock'),
        ('delete', 'Delete')
    ])

    # Optional fields based on action
    category_id = serializers.IntegerField(required=False)
    stock_change = serializers.IntegerField(required=False)
    new_stock = serializers.IntegerField(required=False, min_value=0)

    def validate(self, data):
        action = data.get('action')

        if action == 'update_category' and not data.get('category_id'):
            raise serializers.ValidationError("category_id is required for update_category action")

        if action == 'update_stock' and 'new_stock' not in data and 'stock_change' not in data:
            raise serializers.ValidationError("new_stock or stock_change is required for update_stock action")

        return data