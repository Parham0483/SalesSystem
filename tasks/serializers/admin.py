from rest_framework import serializers

# === Order Statistics ===
class OrderStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    pending = serializers.IntegerField()
    completed = serializers.IntegerField()


# === Product Statistics ===
class ProductStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    active = serializers.IntegerField()
    low_stock = serializers.IntegerField()
    out_of_stock = serializers.IntegerField()


# === Announcement Statistics ===
class AnnouncementStatsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    recent = serializers.IntegerField()


# === Recent Activity Item ===
class RecentActivitySerializer(serializers.Serializer):
    icon = serializers.CharField()         # e.g., "📋"
    description = serializers.CharField()  # e.g., "Order #123 marked as completed"
    time_ago = serializers.CharField()     # e.g., "3 hours ago"
