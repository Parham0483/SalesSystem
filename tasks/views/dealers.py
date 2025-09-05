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

    @action(detail=True, methods=['GET'], url_path='performance')
    def performance(self, request, pk=None):
        """Get comprehensive dealer performance data"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        dealer = self.get_object()

        # Calculate performance metrics
        orders = Order.objects.filter(assigned_dealer=dealer)
        completed_orders = orders.filter(status='completed')

        total_sales = completed_orders.aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0.00')

        commissions = DealerCommission.objects.filter(dealer=dealer)
        total_commission = commissions.aggregate(
            total=Sum('commission_amount')
        )['total'] or Decimal('0.00')

        paid_commission = commissions.filter(is_paid=True).aggregate(
            total=Sum('commission_amount')
        )['total'] or Decimal('0.00')

        pending_commission = commissions.filter(is_paid=False).aggregate(
            total=Sum('commission_amount')
        )['total'] or Decimal('0.00')

        # Calculate conversion rate
        conversion_rate = 0
        if orders.count() > 0:
            conversion_rate = (completed_orders.count() / orders.count()) * 100

        # Calculate average order value
        avg_order_value = 0
        if completed_orders.count() > 0:
            avg_order_value = total_sales / completed_orders.count()

        return Response({
            'dealer': {
                'id': dealer.id,
                'name': dealer.name,
                'email': dealer.email,
                'phone': dealer.phone,
                'company_name': dealer.company_name,
                'date_joined': dealer.date_joined,
                'dealer_commission_rate': float(dealer.dealer_commission_rate)
            },
            'overview': {
                'total_orders': orders.count(),
                'completed_orders': completed_orders.count(),
                'conversion_rate': round(conversion_rate, 1),
                'total_sales': float(total_sales),
                'total_commission_earned': float(total_commission),
                'paid_commission': float(paid_commission),
                'pending_commission': float(pending_commission),
                'avg_order_value': float(avg_order_value),
                'customer_retention_rate': 75.0  # You'll need to implement this calculation
            }
        })

    @action(detail=True, methods=['GET'], url_path='customers')
    def top_customers(self, request, pk=None):
        """Get dealer's top customers with search and sort"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        dealer = self.get_object()
        search = request.query_params.get('search', '')
        sort_by = request.query_params.get('sort_by', 'total_spent')
        order = request.query_params.get('order', 'desc')

        # Get customers who have orders with this dealer
        customer_stats = []
        customers = Customer.objects.filter(
            orders__assigned_dealer=dealer
        ).distinct()

        if search:
            customers = customers.filter(
                Q(name__icontains=search) | Q(email__icontains=search)
            )

        for customer in customers:
            customer_orders = Order.objects.filter(
                customer=customer,
                assigned_dealer=dealer
            )
            completed_orders = customer_orders.filter(status='completed')

            total_spent = completed_orders.aggregate(
                total=Sum('total_amount')
            )['total'] or Decimal('0.00')

            last_order = customer_orders.order_by('-created_at').first()

            customer_stats.append({
                'id': customer.id,
                'name': customer.name,
                'email': customer.email,
                'phone': customer.phone,
                'total_orders': customer_orders.count(),
                'total_spent': float(total_spent),
                'last_order_date': last_order.created_at.date() if last_order else None,
                'status': 'active' if customer.is_active else 'inactive'
            })

        # Sort results
        reverse = order == 'desc'
        if sort_by == 'total_spent':
            customer_stats.sort(key=lambda x: x['total_spent'], reverse=reverse)
        elif sort_by == 'total_orders':
            customer_stats.sort(key=lambda x: x['total_orders'], reverse=reverse)
        elif sort_by == 'last_order_date':
            customer_stats.sort(key=lambda x: x['last_order_date'] or '', reverse=reverse)
        elif sort_by == 'name':
            customer_stats.sort(key=lambda x: x['name'], reverse=reverse)

        return Response({
            'results': customer_stats
        })

    @action(detail=True, methods=['GET'], url_path='recent-orders')
    def recent_orders(self, request, pk=None):
        """Get dealer's recent orders"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        dealer = self.get_object()
        limit = int(request.query_params.get('limit', 10))

        orders = Order.objects.filter(
            assigned_dealer=dealer
        ).order_by('-created_at')[:limit]

        order_data = []
        for order in orders:
            commission = DealerCommission.objects.filter(
                dealer=dealer, order=order
            ).first()

            order_data.append({
                'id': order.order_code,
                'customer_name': order.customer.name,
                'amount': float(order.total_amount),
                'commission': float(commission.commission_amount) if commission else 0,
                'date': order.created_at.date(),
                'status': order.status,
                'items_count': order.items.count()
            })

        return Response({
            'results': order_data
        })

    @action(detail=True, methods=['GET'], url_path='monthly-stats')
    def monthly_stats(self, request, pk=None):
        """Get dealer's monthly statistics"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        dealer = self.get_object()
        year = int(request.query_params.get('year', 2024))

        # You'll need to implement this based on your date filtering needs
        # This is a simplified version
        monthly_data = []
        persian_months = [
            'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
            'مرداد', 'شهریور', 'مهر', 'آبان',
            'آذر', 'دی', 'بهمن', 'اسفند'
        ]

        for i in range(6):  # Last 6 months for example
            month_orders = Order.objects.filter(
                assigned_dealer=dealer,
                status='completed',
                # Add your date filtering here
            )

            month_sales = month_orders.aggregate(
                total=Sum('total_amount')
            )['total'] or Decimal('0.00')

            month_commission = DealerCommission.objects.filter(
                dealer=dealer,
                # Add your date filtering here
            ).aggregate(
                total=Sum('commission_amount')
            )['total'] or Decimal('0.00')

            monthly_data.append({
                'month': persian_months[i % 12],
                'orders': month_orders.count(),
                'sales': float(month_sales),
                'commission': float(month_commission)
            })

        return Response({
            'monthly_stats': monthly_data
        })