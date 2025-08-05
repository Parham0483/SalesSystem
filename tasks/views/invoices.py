# tasks/views/invoices.py - Corrected version with proper imports
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from ..serializers import InvoiceSerializer, OrderDetailSerializer
from ..models import Invoice, Order
from ..services.enhanced_persian_pdf import EnhancedPersianInvoicePDFGenerator  # Fixed import
import logging

logger = logging.getLogger(__name__)


class InvoiceViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Invoice.objects.all().select_related('order__customer')
        return Invoice.objects.filter(order__customer=user).select_related('order__customer')

    @action(detail=True, methods=['GET'], url_path='download-pdf')
    def download_pdf(self, request, pk=None):
        """Download invoice as PDF with enhanced generation"""
        invoice = self.get_object()

        # Check permissions
        if not request.user.is_staff and invoice.order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            # Use enhanced PDF generator
            generator = EnhancedPersianInvoicePDFGenerator(invoice)
            return generator.get_http_response()

        except Exception as e:
            logger.error(f"PDF generation failed for invoice {invoice.id}: {str(e)}")
            return Response({
                'error': f'خطا در تولید PDF: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['POST'], url_path='generate-pdf')
    def generate_pdf(self, request, pk=None):
        """Generate and save PDF for invoice"""
        invoice = self.get_object()

        # Only admin or order owner can generate PDFs
        if not request.user.is_staff and invoice.order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            # Check if customer has required info for official invoice
            if invoice.order.business_invoice_type == 'official':
                is_valid, missing_fields = invoice.order.customer.validate_for_official_invoice()
                if not is_valid:
                    return Response({
                        'error': 'اطلاعات مشتری برای فاکتور رسمی کامل نیست',
                        'missing_fields': missing_fields,
                        'required_action': 'complete_customer_info'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Generate PDF using enhanced generator
            generator = EnhancedPersianInvoicePDFGenerator(invoice)
            pdf_buffer = generator.generate_pdf()

            # Save PDF to invoice model
            from django.core.files.base import ContentFile
            invoice_type = "official" if invoice.order.business_invoice_type == 'official' else "unofficial"
            filename = f"invoice_{invoice.invoice_number}_{invoice_type}.pdf"

            invoice.pdf_file.save(filename, ContentFile(pdf_buffer.getvalue()))

            return Response({
                'message': 'PDF با موفقیت تولید شد',
                'pdf_url': request.build_absolute_uri(invoice.pdf_file.url),
                'invoice_type': invoice_type,
                'file_size': len(pdf_buffer.getvalue())
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"PDF generation failed for invoice {invoice.id}: {str(e)}")
            return Response({
                'error': f'خطا در تولید PDF: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['GET'], url_path='preview-info')
    def preview_info(self, request, pk=None):
        """Get invoice preview information before PDF generation"""
        invoice = self.get_object()

        # Check permissions
        if not request.user.is_staff and invoice.order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            order_data = OrderDetailSerializer(invoice.order, context={'request': request}).data

            # Check customer readiness for official invoice
            customer_ready_for_official = True
            missing_fields = []

            if invoice.order.business_invoice_type == 'official':
                customer_ready_for_official, missing_fields = invoice.order.customer.validate_for_official_invoice()

            return Response({
                'invoice': {
                    'id': invoice.id,
                    'invoice_number': invoice.invoice_number,
                    'invoice_type': invoice.order.business_invoice_type,
                    'total_amount': invoice.total_amount,
                    'payable_amount': invoice.payable_amount,
                    'issued_at': invoice.issued_at,
                    'is_finalized': invoice.is_finalized,
                },
                'order': order_data,
                'customer_ready_for_official': customer_ready_for_official,
                'missing_customer_fields': missing_fields,
                'pdf_exists': bool(invoice.pdf_file),
                'can_generate_pdf': customer_ready_for_official or invoice.order.business_invoice_type == 'unofficial'
            })

        except Exception as e:
            logger.error(f"Preview info failed for invoice {invoice.id}: {str(e)}")
            return Response({
                'error': f'خطا در دریافت اطلاعات: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['POST'], url_path='create-from-order')
    def create_from_order(self, request):
        """Create invoice from order with validation"""
        order_id = request.data.get('order_id')
        invoice_type = request.data.get('invoice_type', 'pre_invoice')

        if not order_id:
            return Response({
                'error': 'شناسه سفارش الزامی است'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = get_object_or_404(Order, id=order_id)

            # Check permissions
            if not request.user.is_staff and order.customer != request.user:
                return Response({
                    'error': 'دسترسی غیرمجاز'
                }, status=status.HTTP_403_FORBIDDEN)

            # Check if invoice already exists
            if hasattr(order, 'invoice'):
                return Response({
                    'error': 'فاکتور برای این سفارش قبلاً ایجاد شده است',
                    'existing_invoice_id': order.invoice.id
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate customer for official invoice
            if order.business_invoice_type == 'official':
                is_valid, missing_fields = order.customer.validate_for_official_invoice()
                if not is_valid:
                    return Response({
                        'error': 'اطلاعات مشتری برای فاکتور رسمی کامل نیست',
                        'missing_fields': missing_fields,
                        'required_action': 'complete_customer_info'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Create invoice
            invoice = Invoice.objects.create(
                order=order,
                invoice_type=invoice_type,
                total_amount=order.quoted_total  # Use quoted_total instead of total_amount
            )

            return Response({
                'message': 'فاکتور با موفقیت ایجاد شد',
                'invoice': InvoiceSerializer(invoice, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Invoice creation failed for order {order_id}: {str(e)}")
            return Response({
                'error': f'خطا در ایجاد فاکتور: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Additional utility view for PDF operations
class PDFUtilityView:
    """Utility class for PDF operations"""

    @staticmethod
    def validate_invoice_for_pdf(invoice):
        """Validate invoice readiness for PDF generation"""
        errors = []

        # Basic invoice validation
        if not invoice.total_amount:
            errors.append('مبلغ فاکتور تعریف نشده است')

        if not invoice.order.items.exists():
            errors.append('فاکتور هیچ آیتمی ندارد')

        # Customer validation for official invoices
        if invoice.order.business_invoice_type == 'official':
            is_valid, missing_fields = invoice.order.customer.validate_for_official_invoice()
            if not is_valid:
                errors.extend([f'اطلاعات مشتری ناقص: {field}' for field in missing_fields])

        return errors

    @staticmethod
    def generate_pdf_with_validation(invoice):
        """Generate PDF with comprehensive validation"""
        # Validate invoice
        errors = PDFUtilityView.validate_invoice_for_pdf(invoice)
        if errors:
            raise ValueError(f"خطاهای اعتبارسنجی: {', '.join(errors)}")

        # Generate PDF
        generator = EnhancedPersianInvoicePDFGenerator(invoice)
        return generator.generate_pdf()


# API endpoint for bulk PDF generation (admin only)
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser


class BulkPDFGenerationView(APIView):
    """Generate PDFs for multiple invoices (admin only)"""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]

    def post(self, request):
        """Generate PDFs for multiple invoices"""
        invoice_ids = request.data.get('invoice_ids', [])

        if not invoice_ids:
            return Response({
                'error': 'لیست شناسه فاکتورها الزامی است'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoices = Invoice.objects.filter(id__in=invoice_ids).select_related('order__customer')

            results = []
            for invoice in invoices:
                try:
                    # Validate and generate PDF
                    generator = EnhancedPersianInvoicePDFGenerator(invoice)
                    pdf_buffer = generator.generate_pdf()

                    # Save PDF
                    from django.core.files.base import ContentFile
                    invoice_type = "official" if invoice.order.business_invoice_type == 'official' else "unofficial"
                    filename = f"invoice_{invoice.invoice_number}_{invoice_type}.pdf"

                    invoice.pdf_file.save(filename, ContentFile(pdf_buffer.getvalue()))

                    results.append({
                        'invoice_id': invoice.id,
                        'invoice_number': invoice.invoice_number,
                        'status': 'success',
                        'pdf_url': request.build_absolute_uri(invoice.pdf_file.url)
                    })

                except Exception as e:
                    results.append({
                        'invoice_id': invoice.id,
                        'invoice_number': invoice.invoice_number,
                        'status': 'error',
                        'error': str(e)
                    })

            success_count = len([r for r in results if r['status'] == 'success'])
            error_count = len([r for r in results if r['status'] == 'error'])

            return Response({
                'message': f'{success_count} فاکتور با موفقیت پردازش شد، {error_count} خطا',
                'results': results,
                'summary': {
                    'total': len(results),
                    'success': success_count,
                    'errors': error_count
                }
            })

        except Exception as e:
            logger.error(f"Bulk PDF generation failed: {str(e)}")
            return Response({
                'error': f'خطا در تولید انبوه PDF: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Customer info update view for official invoices
class CustomerInfoUpdateView(APIView):
    """Update customer info for official invoice requirements"""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Update customer information for official invoices"""
        from ..serializers.customers import CustomerInvoiceInfoUpdateSerializer

        serializer = CustomerInvoiceInfoUpdateSerializer(
            data=request.data,
            context={'invoice_type': 'official'}
        )

        if serializer.is_valid():
            customer = request.user

            # Update customer fields
            for field, value in serializer.validated_data.items():
                if value:  # Only update non-empty values
                    setattr(customer, field, value)

            customer.save()

            # Validate for official invoice
            is_valid, missing_fields = customer.validate_for_official_invoice()

            return Response({
                'message': 'اطلاعات مشتری به‌روزرسانی شد',
                'customer_ready_for_official': is_valid,
                'missing_fields': missing_fields,
                'updated_fields': list(serializer.validated_data.keys())
            })

        return Response({
            'error': 'خطا در اعتبارسنجی اطلاعات',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        """Get current customer info and validation status"""
        customer = request.user
        is_valid, missing_fields = customer.validate_for_official_invoice()

        return Response({
            'customer_info': {
                'name': customer.name,
                'phone': customer.phone,
                'company_name': customer.company_name,
                'national_id': customer.national_id,
                'economic_id': customer.economic_id,
                'complete_address': customer.complete_address,
                'postal_code': customer.postal_code,
                'city': customer.city,
                'province': customer.province,
                'business_type': getattr(customer, 'business_type', 'individual'),  # Fixed field name
            },
            'validation_status': {
                'ready_for_official_invoice': is_valid,
                'missing_fields': missing_fields,
                'completion_percentage': max(0, 100 - len(missing_fields) * 25)  # Rough estimate
            }
        })