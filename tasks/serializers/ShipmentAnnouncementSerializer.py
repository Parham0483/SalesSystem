from rest_framework import serializers
from tasks.models import ShipmentAnnouncementImage, ShipmentAnnouncement, Product


class ShipmentAnnouncementImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShipmentAnnouncementImage
        fields = ['id', 'images', 'alt_text', 'order']

