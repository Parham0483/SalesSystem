# tasks/serializers/ShipmentAnnouncementSerializer.py - FIXED VERSION

from rest_framework import serializers
from tasks.models import ShipmentAnnouncementImage, ShipmentAnnouncement, Product


class ShipmentAnnouncementImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShipmentAnnouncementImage
        fields = ['id', 'image', 'alt_text', 'order']


class ShipmentAnnouncementSerializer(serializers.ModelSerializer):
    """FIXED Shipment Announcement Serializer"""
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    image_url = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()  # For multiple images display

    # FIXED: Add category fields
    category_name = serializers.SerializerMethodField()
    products_count = serializers.ReadOnlyField()

    # FIXED: Add proper validation for related_products
    related_products = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(is_active=True),
        many=True,
        required=False
    )

    class Meta:
        model = ShipmentAnnouncement
        fields = [
            'id', 'title', 'description', 'image', 'image_url', 'images',
            'origin_country', 'created_at', 'created_by', 'created_by_name',
            'is_active', 'is_featured', 'products_count', 'category_name',
            'related_products'
        ]
        read_only_fields = ['created_at', 'created_by', 'created_by_name', 'products_count']

    def get_image_url(self, obj):
        """Get main image URL"""
        request = self.context.get('request')
        if obj.image:
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_images(self, obj):
        """Return all images in the format frontend expects - FIXED"""
        request = self.context.get('request')
        images = []

        # Add main image first if exists
        if obj.image:
            image_url = obj.image.url
            if request:
                image_url = request.build_absolute_uri(image_url)
            images.append({'image': image_url})

        # Add additional images
        for img in obj.images.all().order_by('order'):
            image_url = img.image.url
            if request:
                image_url = request.build_absolute_uri(image_url)
            images.append({'image': image_url})

        return images

    def get_category_name(self, obj):
        """Get category name - placeholder for future category implementation"""
        # For now, we can categorize by origin_country or return a default
        if obj.origin_country:
            return f"From {obj.origin_country}"
        return "General Shipment"

    def validate_title(self, value):
        """Validate title"""
        if not value or not value.strip():
            raise serializers.ValidationError("Title cannot be empty")
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Title must be at least 3 characters long")
        return value.strip()

    def validate_description(self, value):
        """Validate description"""
        if not value or not value.strip():
            raise serializers.ValidationError("Description cannot be empty")
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Description must be at least 10 characters long")
        return value.strip()

    def validate_origin_country(self, value):
        """Validate origin country"""
        if value and len(value.strip()) < 2:
            raise serializers.ValidationError("Origin country must be at least 2 characters long")
        return value.strip() if value else value

    def validate_related_products(self, value):
        """Validate related products"""
        if value and len(value) > 50:  # Reasonable limit
            raise serializers.ValidationError("Cannot relate more than 50 products to a single announcement")
        return value

    def create(self, validated_data):
        """FIXED: Handle creation with proper created_by"""
        # Extract related_products before creating
        related_products = validated_data.pop('related_products', [])

        # CRITICAL FIX: Ensure created_by is set
        request = self.context.get('request')
        if not validated_data.get('created_by') and request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user

        # Create the announcement
        announcement = super().create(validated_data)

        # Set related products
        if related_products:
            announcement.related_products.set(related_products)

        return announcement

    def update(self, instance, validated_data):
        """FIXED: Handle update with related products"""
        # Extract related_products before updating
        related_products = validated_data.pop('related_products', None)

        # Update the instance
        announcement = super().update(instance, validated_data)

        # Update related products if provided
        if related_products is not None:
            announcement.related_products.set(related_products)

        return announcement

    def to_representation(self, instance):
        """Customize output representation"""
        data = super().to_representation(instance)

        # Add related products info if needed
        if instance.related_products.exists():
            related_products_info = []
            for product in instance.related_products.all()[:5]:  # Limit to first 5
                related_products_info.append({
                    'id': product.id,
                    'name': product.name,
                    'image_url': product.get_primary_image_url(),
                    'stock_status': product.stock_status
                })
            data['related_products_info'] = related_products_info
        else:
            data['related_products_info'] = []

        return data