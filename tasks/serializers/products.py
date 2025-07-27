from rest_framework import serializers
from django.utils import timezone
from ..models import Product, ProductCategory, ProductImage, ShipmentAnnouncement


class ProductImageSerializer(serializers.ModelSerializer):
    """Serializer for additional product images"""

    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'alt_text', 'order', 'is_primary']


# tasks/serializers/products.py - Updated ProductSerializer and CategorySerializer

class ProductCategorySerializer(serializers.ModelSerializer):
    """Serializer for product categories with Persian support"""
    products_count = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductCategory
        fields = [
            'id', 'name', 'name_fa', 'display_name', 'description',
            'slug', 'is_active', 'order', 'products_count', 'parent',
            'image', 'created_at'
        ]
        read_only_fields = ['created_at', 'slug']

    def get_products_count(self, obj):
        return obj.products.filter(is_active=True).count()

    def get_display_name(self, obj):
        """Return Persian name if available, otherwise English name"""
        return obj.name_fa if obj.name_fa else obj.name


class ProductSerializer(serializers.ModelSerializer):
    """Enhanced product serializer with Persian category names for all users"""
    image_url = serializers.SerializerMethodField()
    stock_status = serializers.ReadOnlyField()
    is_out_of_stock = serializers.ReadOnlyField()
    category_name = serializers.SerializerMethodField()
    category_details = serializers.SerializerMethodField()
    days_since_created = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'description', 'base_price', 'stock', 'sku',
            'weight', 'origin', 'image', 'image_url',
            'category', 'category_name', 'category_details',
            'is_active', 'is_featured', 'created_at', 'updated_at',
            'meta_title', 'meta_description', 'tags',
            'stock_status', 'is_out_of_stock', 'days_since_created'
        ]
        read_only_fields = ['created_at', 'updated_at', 'stock_status', 'is_out_of_stock']

    def get_image_url(self, obj):
        """Get the primary image URL with full domain"""
        request = self.context.get('request')

        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            else:
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

    def get_category_name(self, obj):
        """Return Persian category name for ALL users"""
        if obj.category:
            return obj.category.display_name
        return None

    def get_category_details(self, obj):
        """Get complete category details with Persian names for ALL users"""
        if obj.category:
            return {
                'id': obj.category.id,
                'name': obj.category.name,
                'name_fa': obj.category.name_fa,
                'display_name': obj.category.display_name,
                'slug': obj.category.slug,
                'description': obj.category.description
            }
        return None

    def get_days_since_created(self, obj):
        """Get days since product was created"""
        from django.utils import timezone
        return (timezone.now() - obj.created_at).days

    def validate_image(self, value):
        """Custom validation for image field"""
        # If it's a string (URL), it means no new image is being uploaded
        if isinstance(value, str):
            # Return None to indicate no change to image
            return None

        # If it's a file, validate it
        if hasattr(value, 'read'):
            # Additional file validation can go here
            return value

        return value

    def update(self, instance, validated_data):
        """Custom update method to handle image properly"""
        # Remove image from validated_data if it's None (no new image)
        image = validated_data.pop('image', 'no_change')

        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Only update image if a new one was provided
        if image != 'no_change' and image is not None:
            instance.image = image

        instance.save()
        return instance

    def create(self, validated_data):
        """Create product with automatic SKU generation if needed"""
        if not validated_data.get('sku'):
            from django.utils import timezone
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


# Add debugging to your ShipmentAnnouncementSerializer

class ShipmentAnnouncementSerializer(serializers.ModelSerializer):
    """SIMPLIFIED Shipment Announcement Serializer - READ ONLY"""
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    image_url = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    products_count = serializers.ReadOnlyField()

    class Meta:
        model = ShipmentAnnouncement
        fields = [
            'id', 'title', 'description', 'image_url', 'images',
            'origin_country', 'shipment_date', 'estimated_arrival', 'product_categories',
            'created_at', 'created_by', 'created_by_name',
            'is_active', 'is_featured', 'products_count', 'view_count'
        ]
        read_only_fields = [
            'id', 'created_at', 'created_by', 'created_by_name',
            'products_count', 'view_count', 'image_url', 'images'
        ]

    def get_image_url(self, obj):
        """Get main image URL"""
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_images(self, obj):
        """Return all images in the format frontend expects"""
        request = self.context.get('request')
        images = []


        # Add main image first if exists
        if obj.image:
            image_url = obj.image.url
            if request:
                image_url = request.build_absolute_uri(image_url)
            images.append({'image': image_url})

        # Add additional images
        additional_images = obj.images.all().order_by('order')

        for img in additional_images:
            image_url = img.image.url
            if request:
                image_url = request.build_absolute_uri(image_url)
            images.append({'image': image_url})


        return images

    def to_representation(self, instance):
        """Add debugging to see what's being returned"""
        data = super().to_representation(instance)
        return data

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