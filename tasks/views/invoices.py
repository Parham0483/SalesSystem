# tasks/views/invoices.py - Updated version
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.authentication import JWTAuthentication
from ..serializers import InvoiceSerializer
from ..models import Invoice


class InvoiceViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Invoice.objects.all()
        return Invoice.objects.filter(order__customer=user)

    @action(detail=True, methods=['GET'], url_path='download-pdf')
    def download_pdf(self, request, pk=None):
        """Download invoice as PDF"""
        invoice = self.get_object()

        # Check permissions
        if not request.user.is_staff and invoice.order.customer != request.user:
            return Response({
                'error': 'Permission denied'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            return invoice.download_pdf_response()
        except Exception as e:
            return Response({
                'error': f'PDF generation failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['POST'], url_path='generate-pdf')
    def generate_pdf(self, request, pk=None):
        """Generate and save PDF for invoice"""
        invoice = self.get_object()

        # Only admin can generate PDFs
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            pdf_file = invoice.generate_pdf()
            return Response({
                'message': 'PDF generated successfully',
                'pdf_url': request.build_absolute_uri(pdf_file.url)
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': f'PDF generation failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)