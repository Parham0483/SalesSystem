from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db.models import Q, Sum
from decimal import Decimal

from ..models import Customer, Order, DealerCommission
from ..serializers.dealers import (
    DealerSerializer, DealerCommissionSerializer
)
from ..serializers.orders import OrderDetailSerializer


class DealerViewSet(viewsets.ModelViewSet):
    """ViewSet for dealer management"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = DealerSerializer

    def get_queryset(self):
        """Only admin can see all dealers"""
        if self.request.user.is_staff:
            return Customer.objects.filter(is_dealer=True)
        elif self.request.user.is_dealer:
            # Dealers can only see themselves
            return Customer.objects.filter(id=self.request.user.id, is_dealer=True)
        else:
            return Customer.objects.none()

    def get_permissions(self):
        """Custom permissions for different actions"""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Only admin can modify dealers
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def create(self, request, *args, **kwargs):
        """Admin creates a new dealer"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        """Admin updates dealer information"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['GET'], url_path='list-for-assignment')
    def list_for_assignment(self, request):
        """Get list of dealers for admin to assign to orders"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        dealers = Customer.objects.filter(is_dealer=True, is_active=True)
        dealer_data = []

        for dealer in dealers:
            dealer_data.append({
                'id': dealer.id,
                'name': dealer.name,
                'email': dealer.email,
                'dealer_code': dealer.dealer_code,
                'commission_rate': float(dealer.dealer_commission_rate),
                'assigned_orders_count': dealer.assigned_orders.count(),
                'active_orders_count': dealer.assigned_orders.filter(
                    status__in=['pending_pricing', 'waiting_customer_approval', 'confirmed']
                ).count()
            })

        return Response({
            'dealers': dealer_data
        })

    @action(detail=True, methods=['GET'], url_path='assigned-orders')
    def assigned_orders(self, request, pk=None):
        """Get orders assigned to a specific dealer"""
        dealer = self.get_object()

        # Permission check
        if not request.user.is_staff and request.user != dealer:
            return Response({
                'error': 'Permission denied.'
            }, status=status.HTTP_403_FORBIDDEN)

        orders = Order.objects.filter(assigned_dealer=dealer).order_by('-created_at')
        serializer = OrderDetailSerializer(orders, many=True)

        return Response({
            'dealer': DealerSerializer(dealer).data,
            'orders': serializer.data,
            'count': orders.count()
        })

    @action(detail=True, methods=['GET'], url_path='commission-summary')
    def commission_summary(self, request, pk=None):
        """Get commission summary for a dealer"""
        dealer = self.get_object()

        # Permission check
        if not request.user.is_staff and request.user != dealer:
            return Response({
                'error': 'Permission denied.'
            }, status=status.HTTP_403_FORBIDDEN)

        commissions = DealerCommission.objects.filter(dealer=dealer)

        total_earned = commissions.filter(is_paid=True).aggregate(
            total=Sum('commission_amount')
        )['total'] or Decimal('0.00')

        total_pending = commissions.filter(is_paid=False).aggregate(
            total=Sum('commission_amount')
        )['total'] or Decimal('0.00')

        recent_commissions = commissions.order_by('-created_at')[:10]

        return Response({
            'dealer': DealerSerializer(dealer).data,
            'summary': {
                'total_earned': float(total_earned),
                'total_pending': float(total_pending),
                'total_orders': dealer.assigned_orders.count(),
                'completed_orders': dealer.assigned_orders.filter(status='completed').count()
            },
            'recent_commissions': DealerCommissionSerializer(recent_commissions, many=True).data
        })

    @action(detail=False, methods=['POST'], url_path='convert-to-dealer')
    def convert_to_dealer(self, request):
        """Admin converts a regular user to a dealer"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        commission_rate = request.data.get('commission_rate', 0)

        try:
            user = Customer.objects.get(id=user_id)

            if user.is_dealer:
                return Response({
                    'error': 'User is already a dealer'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Convert to dealer
            user.is_dealer = True
            user.dealer_commission_rate = Decimal(str(commission_rate))
            user.save()

            return Response({
                'message': f'{user.name} has been converted to a dealer',
                'dealer': DealerSerializer(user).data
            })

        except Customer.DoesNotExist:
            return Response({
                'error': 'User not found'
            }, status=status.HTTP_404_NOT_FOUND)