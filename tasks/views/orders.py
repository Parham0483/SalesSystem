# tasks/views/orders.py - COMPLETE FIXED VERSION
from django.db.models import Sum, Q
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
    OrderItemSerializer,
)
from ..serializers.dealers import (
    DealerSerializer, DealerAssignmentSerializer,
    DealerNotesUpdateSerializer
)
from ..models import Order, OrderItem, Customer
from ..services.notification_service import NotificationService


class OrderViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """FIXED: Allow dealers to access their assigned orders"""
        user = self.request.user

        if user.is_staff:
            # Admin can see all orders
            return Order.objects.all().order_by('-created_at')
        elif user.is_dealer:
            # Dealers can see both their customer orders AND assigned orders
            return Order.objects.filter(
                Q(customer=user) | Q(assigned_dealer=user)
            ).distinct().order_by('-created_at')
        else:
            # Regular customers see only their orders
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

    def retrieve(self, request, *args, **kwargs):
        """FIXED: Custom retrieve method with better error handling"""
        try:
            order = self.get_object()
            serializer = self.get_serializer(order)

            # Log access for debugging
            print(
                f"🔍 Order {order.id} accessed by {request.user.name} (Staff: {request.user.is_staff}, Dealer: {request.user.is_dealer})")

            return Response(serializer.data)
        except Exception as e:
            print(f"❌ Error retrieving order: {str(e)}")
            return Response({
                'error': f'Order not found or access denied: {str(e)}'
            }, status=status.HTTP_404_NOT_FOUND)

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                order = serializer.save()
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

            order.customer_approve()
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

            order.customer_reject(rejection_reason)
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

    @action(detail=True, methods=['POST'], url_path='complete')
    def complete_order(self, request, *args, **kwargs):
        """Admin completes an order and creates commission"""
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

            completed_order, invoice = order.mark_as_completed(request.user)

            # Create dealer commission if applicable
            commission_created = False
            if order.assigned_dealer and order.dealer_commission_amount > 0:
                from ..models import DealerCommission
                commission = DealerCommission.create_for_completed_order(order)
                if commission:
                    commission_created = True
                    print(
                        f"💰 Commission created for dealer {order.assigned_dealer.name}: ${commission.commission_amount}")

            return Response({
                'message': 'Order completed successfully',
                'order': OrderDetailSerializer(completed_order).data,
                'invoice_id': invoice.id,
                'commission_created': commission_created
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': f'Order completion failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['POST'], url_path='assign-dealer')
    def assign_dealer(self, request, *args, **kwargs):
        """ENHANCED: Admin assigns a dealer with custom commission rate support"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()
        serializer = DealerAssignmentSerializer(data=request.data, context={'order': order})

        if serializer.is_valid():
            dealer_id = serializer.validated_data['dealer_id']
            dealer_notes = serializer.validated_data.get('dealer_notes', '')
            custom_commission_rate = serializer.validated_data.get('custom_commission_rate')

            try:
                dealer = Customer.objects.get(id=dealer_id, is_dealer=True, is_active=True)

                # Determine effective commission rate
                if custom_commission_rate is not None:
                    effective_rate = custom_commission_rate
                else:
                    effective_rate = dealer.dealer_commission_rate
                    if effective_rate <= 0:
                        return Response({
                            'error': f'Dealer {dealer.name} has no default commission rate set. Please provide a custom commission rate.'
                        }, status=status.HTTP_400_BAD_REQUEST)

                # Assign dealer with custom commission rate
                success = order.assign_dealer(dealer, request.user, custom_commission_rate)

                if success:
                    if dealer_notes:
                        order.dealer_notes = dealer_notes
                        order.save()

                    print(f"✅ Dealer {dealer.name} assigned to Order #{order.id} with {effective_rate}% commission")

                    return Response({
                        'message': f'Dealer {dealer.name} assigned successfully with {effective_rate}% commission',
                        'order': OrderDetailSerializer(order).data,
                        'dealer_info': {
                            'name': dealer.name,
                            'email': dealer.email,
                            'commission_rate': float(effective_rate),
                            'dealer_code': dealer.dealer_code,
                            'is_custom_rate': custom_commission_rate is not None
                        }
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({
                        'error': 'Failed to assign dealer'
                    }, status=status.HTTP_400_BAD_REQUEST)

            except Customer.DoesNotExist:
                return Response({
                    'error': 'Dealer not found'
                }, status=status.HTTP_404_NOT_FOUND)
            except Exception as e:
                return Response({
                    'error': f'Error assigning dealer: {str(e)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'error': 'Invalid data',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['POST'], url_path='remove-dealer')
    def remove_dealer(self, request, *args, **kwargs):
        """Admin removes dealer from an order"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()
        success = order.remove_dealer(request.user)

        if success:
            return Response({
                'message': 'Dealer removed successfully',
                'order': OrderDetailSerializer(order).data
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'message': 'No dealer was assigned to this order',
                'order': OrderDetailSerializer(order).data
            }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['POST'], url_path='update-dealer-notes')
    def update_dealer_notes(self, request, *args, **kwargs):
        """Update dealer notes"""
        order = self.get_object()

        if not (request.user.is_staff or request.user == order.assigned_dealer):
            return Response({
                'error': 'Permission denied. Only admin or assigned dealer can update notes.'
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = DealerNotesUpdateSerializer(data=request.data)

        if serializer.is_valid():
            dealer_notes = serializer.validated_data['dealer_notes']
            success = order.update_dealer_notes(dealer_notes, request.user)

            if success:
                return Response({
                    'message': 'Dealer notes updated successfully',
                    'order': OrderDetailSerializer(order).data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'No dealer assigned to this order'
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='my-assigned-orders')
    def my_assigned_orders(self, request):
        """ENHANCED: Get orders assigned to the current dealer"""
        if not request.user.is_dealer:
            return Response({
                'error': 'Permission denied. Dealer access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        orders = Order.objects.filter(assigned_dealer=request.user).order_by('-created_at')
        serializer = OrderDetailSerializer(orders, many=True)

        # Calculate summary stats
        total_value = orders.filter(status='completed').aggregate(
            total=Sum('quoted_total')
        )['total'] or 0

        pending_commissions = 0
        for order in orders.filter(status='completed'):
            pending_commissions += order.dealer_commission_amount

        return Response({
            'count': orders.count(),
            'orders': serializer.data,
            'summary': {
                'total_orders': orders.count(),
                'completed_orders': orders.filter(status='completed').count(),
                'pending_orders': orders.filter(status__in=[
                    'pending_pricing', 'waiting_customer_approval', 'confirmed'
                ]).count(),
                'total_value': float(total_value),
                'estimated_commission': float(pending_commissions)
            }
        })

    @action(detail=False, methods=['GET'], url_path='completed')
    def completed_orders(self, request):
        """Get completed orders"""
        if request.user.is_staff:
            orders = Order.objects.filter(status='completed').order_by('-completion_date')
        elif request.user.is_dealer:
            # Dealers see completed orders they were assigned to
            orders = Order.objects.filter(
                Q(customer=request.user, status='completed') |
                Q(assigned_dealer=request.user, status='completed')
            ).distinct().order_by('-completion_date')
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
        elif request.user.is_dealer:
            # Dealers see orders waiting approval that they're assigned to
            orders = Order.objects.filter(
                Q(customer=request.user, status='waiting_customer_approval') |
                Q(assigned_dealer=request.user, status='waiting_customer_approval')
            ).distinct().order_by('pricing_date')
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

    @action(detail=False, methods=['GET'], url_path='dealer-dashboard-stats')
    def dealer_dashboard_stats(self, request):
        """ENHANCED: Get dashboard statistics for dealer"""
        if not request.user.is_dealer:
            return Response({
                'error': 'Permission denied. Dealer access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        orders = Order.objects.filter(assigned_dealer=request.user)

        # Calculate commission stats
        completed_orders = orders.filter(status='completed')
        total_commission = sum(order.dealer_commission_amount for order in completed_orders)

        stats = {
            'total_orders': orders.count(),
            'pending_orders': orders.filter(status='pending_pricing').count(),
            'waiting_approval': orders.filter(status='waiting_customer_approval').count(),
            'confirmed_orders': orders.filter(status='confirmed').count(),
            'completed_orders': completed_orders.count(),
            'total_value': float(orders.filter(
                status='completed'
            ).aggregate(total=Sum('quoted_total'))['total'] or 0),
            'commission_rate': float(request.user.dealer_commission_rate),
            'total_commission_earned': float(total_commission)
        }

        return Response({
            'dealer': DealerSerializer(request.user).data,
            'stats': stats
        })


class OrderItemViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = OrderItemSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return OrderItem.objects.all()
        elif user.is_dealer:
            # Dealers can see items from their assigned orders
            return OrderItem.objects.filter(
                Q(order__customer=user) | Q(order__assigned_dealer=user)
            ).distinct()
        else:
            return OrderItem.objects.filter(order__customer=user)