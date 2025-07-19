from rest_framework import serializers
from ..models import Customer


class CustomerSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Customer
        fields = ['id', 'name', 'email', 'password', 'phone', 'company_name']
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': True},
            'name': {'required': True}
        }

    def create(self, validated_data):
        password = validated_data.pop('password')
        customer = Customer.objects.create_user(
            password=password,
            **validated_data
        )
        return customer

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance