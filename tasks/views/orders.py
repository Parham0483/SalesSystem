# tasks/views/orders.py - Add these imports and update methods
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone
from ..serializers import (
    OrderCreateSerializer,
    OrderAdminUpdateSerializer,
    OrderDetailSerializer,
    OrderItemSerializer
)
from ..models import Order, OrderItem

# ADD this import for notifications
from ..services.notification_service import NotificationService


class OrderViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Order.objects.all().order_by('-created_at')
        return Order.objects.filter(customer=user).order_by('-created_at')

    def get_serializer_class(self):
        user = self.request.user
        if user.is_staff:
            if self.action in ['update', 'partial_update', 'submit_pricing']:
                return OrderAdminUpdateSerializer
            if self.action in ['retrieve', 'list']:
                return OrderDetailSerializer
        else:
            if self.action == 'create':
                return OrderCreateSerializer
            if self.action in ['retrieve', 'list']:
                return OrderDetailSerializer
        return OrderDetailSerializer

    # UPDATED create method with email notification
    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                order = serializer.save()

                # STEP 1: Send notification to admin
                NotificationService.notify_admin_new_order(order)

                return Response({
                    'message': 'Order created successfully',
                    'order_id': order.id,
                    'status': order.status
                }, status=status.HTTP_201_CREATED)
            return Response({
                'error': 'Invalid data',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'error': f'Order creation failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # UPDATED submit_pricing method with email notification
    @action(detail=True, methods=['POST'], url_path='submit_pricing')
    def submit_pricing(self, request, *args, **kwargs):
        """Admin submits pricing for an order"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            order = self.get_object()

            if order.status != 'pending_pricing':
                return Response({
                    'error': f'Cannot price order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            serializer = OrderAdminUpdateSerializer(
                order,
                data=request.data,
                context={'request': request}
            )

            if serializer.is_valid():
                updated_order = serializer.save()

                # STEP 2: Send notification to customer
                NotificationService.notify_customer_pricing_ready(updated_order)

                return Response({
                    'message': 'Pricing submitted successfully',
                    'order': OrderDetailSerializer(updated_order).data
                }, status=status.HTTP_200_OK)

            return Response({
                'error': 'Invalid pricing data',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'error': f'Pricing submission failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # UPDATED approve_order method with email notification
    @action(detail=True, methods=['POST'], url_path='approve')
    def approve_order(self, request, *args, **kwargs):
        """Customer approves the order pricing"""
        try:
            order = self.get_object()

            if order.customer != request.user:
                return Response({
                    'error': 'Permission denied'
                }, status=status.HTTP_403_FORBIDDEN)

            if order.status != 'waiting_customer_approval':
                return Response({
                    'error': f'Cannot approve order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Approve the order
            order.customer_approve()

            # STEP 3a: Send confirmation email with PDF
            NotificationService.notify_customer_order_confirmed(order, include_pdf=True)
            NotificationService.notify_admin_order_status_change(order, 'confirmed', request.user)

            return Response({
                'message': 'Order approved successfully',
                'order': OrderDetailSerializer(order).data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': f'Order approval failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # UPDATED reject_order method with email notification
    @action(detail=True, methods=['POST'], url_path='reject')
    def reject_order(self, request, *args, **kwargs):
        """Customer rejects the order pricing"""
        try:
            order = self.get_object()

            if order.customer != request.user:
                return Response({
                    'error': 'Permission denied'
                }, status=status.HTTP_403_FORBIDDEN)

            if order.status != 'waiting_customer_approval':
                return Response({
                    'error': f'Cannot reject order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            rejection_reason = request.data.get('rejection_reason', '')
            if not rejection_reason:
                return Response({
                    'error': 'Rejection reason is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Reject the order
            order.customer_reject(rejection_reason)

            # STEP 3b: Send rejection notification with reason
            NotificationService.notify_customer_order_rejected(order, rejection_reason)
            NotificationService.notify_admin_order_status_change(order, 'rejected', request.user)

            return Response({
                'message': 'Order rejected successfully',
                'order': OrderDetailSerializer(order).data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': f'Order rejection failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # NEW: Complete order action
    @action(detail=True, methods=['POST'], url_path='complete')
    def complete_order(self, request, *args, **kwargs):
        """Admin completes an order"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            order = self.get_object()

            if order.status != 'confirmed':
                return Response({
                    'error': f'Cannot complete order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Complete the order
            completed_order, invoice = order.mark_as_completed(request.user)

            return Response({
                'message': 'Order completed successfully',
                'order': OrderDetailSerializer(completed_order).data,
                'invoice_id': invoice.id
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': f'Order completion failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # NEW: Get completed orders
    @action(detail=False, methods=['GET'], url_path='completed')
    def completed_orders(self, request):
        """Get completed orders"""
        if request.user.is_staff:
            orders = Order.objects.filter(status='completed').order_by('-completion_date')
        else:
            orders = Order.objects.filter(
                customer=request.user,
                status='completed'
            ).order_by('-completion_date')

        serializer = OrderDetailSerializer(orders, many=True)
        return Response({
            'count': orders.count(),
            'orders': serializer.data
        })

    @action(detail=False, methods=['GET'], url_path='pending-pricing')
    def pending_pricing(self, request):
        """Get orders pending pricing (admin only)"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        orders = Order.objects.filter(status='pending_pricing').order_by('created_at')
        serializer = OrderDetailSerializer(orders, many=True)
        return Response({
            'count': orders.count(),
            'orders': serializer.data
        })

    @action(detail=False, methods=['GET'], url_path='waiting-approval')
    def waiting_approval(self, request):
        """Get orders waiting for customer approval"""
        if request.user.is_staff:
            orders = Order.objects.filter(status='waiting_customer_approval').order_by('pricing_date')
        else:
            orders = Order.objects.filter(
                customer=request.user,
                status='waiting_customer_approval'
            ).order_by('pricing_date')

        serializer = OrderDetailSerializer(orders, many=True)
        return Response({
            'count': orders.count(),
            'orders': serializer.data
        })


class OrderItemViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = OrderItemSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return OrderItem.objects.all()
        return OrderItem.objects.filter(order__customer=user)