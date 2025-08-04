import logging
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from ..serializers import CustomerSerializer
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from ..models import Customer
from ..serializers.customers import CustomerInvoiceInfoSerializer, CustomerInvoiceInfoUpdateSerializer

logger = logging.getLogger(__name__)


class CustomerViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    serializer_class = CustomerSerializer

    def get_permissions(self):
        if self.action == 'create':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Customer.objects.all()
        return Customer.objects.filter(id=user.id)


@method_decorator(csrf_exempt, name='dispatch')
class CustomerInfoViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['GET'], url_path='invoice-info')
    def get_invoice_info(self, request):
        """Get current customer's invoice information"""
        try:
            customer = request.user
            serializer = CustomerInvoiceInfoSerializer(customer)

            return Response({
                'customer_info': serializer.data,
                'has_complete_info': self._check_complete_info(customer),
                'missing_fields': self._get_missing_fields(customer)
            })

        except Exception as e:
            logger.error(f"❌ Error getting customer info: {str(e)}")
            return Response(
                {'error': 'خطا در دریافت اطلاعات مشتری'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['POST'], url_path='update-invoice-info')
    def update_invoice_info(self, request):
        """Update customer's invoice information"""
        try:
            customer = request.user
            invoice_type = request.data.get('invoice_type', 'unofficial')
            customer_data = request.data.get('customer_info', {})

            serializer = CustomerInvoiceInfoUpdateSerializer(
                data=customer_data,
                context={'invoice_type': invoice_type}
            )

            if not serializer.is_valid():
                return Response({
                    'error': 'اطلاعات وارد شده صحیح نیست',
                    'details': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            # Update customer fields
            validated_data = serializer.validated_data
            updated_fields = []

            for field, value in validated_data.items():
                if hasattr(customer, field):
                    old_value = getattr(customer, field)
                    if old_value != value:
                        setattr(customer, field, value)
                        updated_fields.append(field)

            if updated_fields:
                customer.save(update_fields=updated_fields)
                logger.info(f"📝 Customer {customer.name} updated fields: {updated_fields}")

            return Response({
                'message': 'اطلاعات با موفقیت به‌روزرسانی شد',
                'updated_fields': updated_fields,
                'customer_info': CustomerInvoiceInfoSerializer(customer).data
            })

        except Exception as e:
            logger.error(f"❌ Error updating customer info: {str(e)}")
            return Response(
                {'error': 'خطا در به‌روزرسانی اطلاعات'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _check_complete_info(self, customer):
        """Check if customer has complete information for official invoice"""
        required_fields = ['name', 'phone', 'complete_address', 'national_id', 'postal_code']
        return all(getattr(customer, field) for field in required_fields)

    def _get_missing_fields(self, customer):
        """Get list of missing required fields for official invoice"""
        required_fields = {
            'name': 'نام',
            'phone': 'شماره تماس',
            'complete_address': 'آدرس کامل',
            'national_id': 'شناسه ملی',
            'postal_code': 'کد پستی'
        }

        missing = []
        for field, label in required_fields.items():
            if not getattr(customer, field):
                missing.append({'field': field, 'label': label})

        return missing