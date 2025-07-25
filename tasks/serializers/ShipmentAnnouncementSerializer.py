# Update your ShipmentAnnouncementSerializer
from rest_framework import serializers

from tasks.models import ShipmentAnnouncementImage, ShipmentAnnouncement


class ShipmentAnnouncementImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShipmentAnnouncementImage
        fields = ['id', 'image', 'alt_text', 'order']


class ShipmentAnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    image_url = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()  # For multiple images display

    class Meta:
        model = ShipmentAnnouncement
        fields = [
            'id', 'title', 'description', 'image', 'image_url', 'images',
            'origin_country', 'estimated_arrival',
            'created_at', 'created_by', 'created_by_name',
            'is_active', 'is_featured'
        ]
        read_only_fields = ['created_at', 'created_by']

    def get_image_url(self, obj):
        if obj.image:
            return obj.image.url
        return None

    def get_images(self, obj):
        # Return all images in the format frontend expects
        images = []
        # Add main image first
        if obj.image:
            images.append({'image': obj.image.url})
        # Add additional images
        for img in obj.images.all():
            images.append({'image': img.image.url})
        return images

    def create(self, validated_data):
        # Handle multiple image uploads
        request = self.context.get('request')
        announcement = super().create(validated_data)

        # Handle multiple images from request.FILES
        if request and hasattr(request, 'FILES'):
            images = request.FILES.getlist('images')  # Get multiple files
            for i, image_file in enumerate(images):
                ShipmentAnnouncementImage.objects.create(
                    announcement=announcement,
                    image=image_file,
                    order=i
                )

        return announcement