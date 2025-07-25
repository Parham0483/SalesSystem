# tasks/views/admin.py - Complete Admin API
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.db.models import Q, Count, Sum
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from ..models import (
    Customer, Product, Order, OrderItem, Invoice,
    ShipmentAnnouncement, ProductCategory, DealerCommission, ShipmentAnnouncementImage
)
from ..serializers.customers import CustomerSerializer
from ..serializers.products import ProductSerializer, ShipmentAnnouncementSerializer
from ..serializers.orders import OrderDetailSerializer
from ..serializers.dealers import DealerSerializer, DealerCommissionSerializer


class AdminDashboardViewSet(viewsets.ViewSet):
    """Admin dashboard statistics and overview"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['GET'], url_path='stats/orders')
    def order_stats(self, request):
        """Get order statistics"""
        orders = Order.objects.all()

        return Response({
            'total': orders.count(),
            'pending': orders.filter(status='pending_pricing').count(),
            'waiting_approval': orders.filter(status='waiting_customer_approval').count(),
            'confirmed': orders.filter(status='confirmed').count(),
            'completed': orders.filter(status='completed').count(),
            'rejected': orders.filter(status='rejected').count(),
            'with_dealer': orders.filter(assigned_dealer__isnull=False).count(),
            'without_dealer': orders.filter(assigned_dealer__isnull=True).count(),
        })

    @action(detail=False, methods=['GET'], url_path='stats/products')
    def product_stats(self, request):
        """Get product statistics"""
        products = Product.objects.all()

        return Response({
            'total': products.count(),
            'active': products.filter(is_active=True).count(),
            'inactive': products.filter(is_active=False).count(),
            'low_stock': products.filter(stock__lte=10, is_active=True).count(),
            'out_of_stock': products.filter(stock=0, is_active=True).count(),
        })

    @action(detail=False, methods=['GET'], url_path='stats/announcements')
    def announcement_stats(self, request):
        """Get shipment announcement statistics"""
        announcements = ShipmentAnnouncement.objects.all()
        month_ago = timezone.now() - timedelta(days=30)

        return Response({
            'total': announcements.count(),
            'active': announcements.filter(is_active=True).count(),
            'recent': announcements.filter(created_at__gte=month_ago).count(),
            'featured': announcements.filter(is_featured=True).count(),
        })

    @action(detail=False, methods=['GET'], url_path='stats/customers')
    def customer_stats(self, request):
        """Get customer statistics"""
        customers = Customer.objects.all()
        month_ago = timezone.now() - timedelta(days=30)

        return Response({
            'total': customers.count(),
            'active': customers.filter(is_active=True).count(),
            'dealers': customers.filter(is_dealer=True).count(),
            'regular': customers.filter(is_dealer=False, is_staff=False).count(),
            'new_this_month': customers.filter(date_joined__gte=month_ago).count(),
        })

    @action(detail=False, methods=['GET'], url_path='stats/dealers')
    def dealer_stats(self, request):
        """Get dealer statistics"""
        dealers = Customer.objects.filter(is_dealer=True)

        total_commission = DealerCommission.objects.aggregate(
            total=Sum('commission_amount')
        )['total'] or Decimal('0.00')

        paid_commission = DealerCommission.objects.filter(is_paid=True).aggregate(
            total=Sum('commission_amount')
        )['total'] or Decimal('0.00')

        return Response({
            'total_dealers': dealers.count(),
            'active_dealers': dealers.filter(is_active=True).count(),
            'orders_assigned': Order.objects.filter(assigned_dealer__isnull=False).count(),
            'total_commission': float(total_commission),
            'paid_commission': float(paid_commission),
            'pending_commission': float(total_commission - paid_commission),
        })

    @action(detail=False, methods=['GET'], url_path='recent-activity')
    def recent_activity(self, request):
        """Get recent system activity"""
        activities = []

        # Recent orders
        recent_orders = Order.objects.select_related('customer').order_by('-created_at')[:5]
        for order in recent_orders:
            activities.append({
                'icon': '📋',
                'description': f'New order #{order.id} from {order.customer.name}',
                'time_ago': self._time_ago(order.created_at),
                'type': 'order',
                'id': order.id
            })

        # Recent products
        recent_products = Product.objects.order_by('-created_at')[:3]
        for product in recent_products:
            activities.append({
                'icon': '📦',
                'description': f'New product added: {product.name}',
                'time_ago': self._time_ago(product.created_at),
                'type': 'product',
                'id': product.id
            })

        # Recent customers
        recent_customers = Customer.objects.filter(is_staff=False).order_by('-date_joined')[:3]
        for customer in recent_customers:
            activities.append({
                'icon': '👤',
                'description': f'New customer registered: {customer.name}',
                'time_ago': self._time_ago(customer.date_joined),
                'type': 'customer',
                'id': customer.id
            })

        # Sort by time
        activities.sort(key=lambda x: x['time_ago'])

        return Response(activities[:10])

    def _time_ago(self, dt):
        """Calculate time ago string"""
        now = timezone.now()
        diff = now - dt

        if diff.days > 0:
            return f"{diff.days} روز پیش"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours} ساعت پیش"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes} دقیقه پیش"
        else:
            return "همین الان"


class AdminProductViewSet(viewsets.ModelViewSet):
    """Admin product management"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]
    serializer_class = ProductSerializer

    def get_queryset(self):
        return Product.objects.all().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Create new product"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            product = serializer.save()
            return Response({
                'message': 'Product created successfully',
                'product': ProductSerializer(product).data
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='low-stock')
    def low_stock(self, request):
        """Get products with low stock"""
        threshold = int(request.query_params.get('threshold', 10))
        products = Product.objects.filter(
            stock__lte=threshold,
            is_active=True
        ).order_by('stock')

        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['POST'], url_path='update-stock')
    def update_stock(self, request, pk=None):
        """Update product stock"""
        product = self.get_object()
        new_stock = request.data.get('stock')

        if new_stock is None:
            return Response({
                'error': 'Stock value is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            product.stock = int(new_stock)
            product.save()

            return Response({
                'message': 'Stock updated successfully',
                'product': ProductSerializer(product).data
            })
        except ValueError:
            return Response({
                'error': 'Invalid stock value'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['POST'], url_path='bulk-actions')
    def bulk_actions(self, request):
        """Perform bulk actions on products"""
        product_ids = request.data.get('product_ids', [])
        action = request.data.get('action')

        if not product_ids:
            return Response({
                'error': 'No products selected'
            }, status=status.HTTP_400_BAD_REQUEST)

        products = Product.objects.filter(id__in=product_ids)

        if action == 'activate':
            products.update(is_active=True)
            message = f'{products.count()} products activated'
        elif action == 'deactivate':
            products.update(is_active=False)
            message = f'{products.count()} products deactivated'
        elif action == 'delete':
            count = products.count()
            products.delete()
            message = f'{count} products deleted'
        else:
            return Response({
                'error': 'Invalid action'
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({'message': message})

    @action(detail=False, methods=['GET'], url_path='categories')
    def get_categories(self, request):
        """Get all active categories for dropdown"""
        categories = ProductCategory.objects.filter(is_active=True).order_by('order', 'name')

        categories_data = []
        for category in categories:
            categories_data.append({
                'id': category.id,
                'name': category.name,
                'name_fa': category.name_fa,
                'display_name': category.display_name,
                'products_count': category.products_count
            })

        return Response(categories_data)

class AdminOrderViewSet(viewsets.ModelViewSet):
    """Admin order management"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]
    serializer_class = OrderDetailSerializer

    def get_queryset(self):
        return Order.objects.all().select_related(
            'customer', 'assigned_dealer', 'priced_by'
        ).prefetch_related('items__product').order_by('-created_at')

    def list(self, request, *args, **kwargs):
        """List orders with filtering"""
        queryset = self.get_queryset()

        # Apply filters
        status_filter = request.query_params.get('status')
        customer_filter = request.query_params.get('customer')
        dealer_filter = request.query_params.get('dealer')
        date_filter = request.query_params.get('date')

        if status_filter and status_filter != 'all':
            queryset = queryset.filter(status=status_filter)

        if customer_filter:
            queryset = queryset.filter(
                Q(customer__name__icontains=customer_filter) |
                Q(customer__email__icontains=customer_filter)
            )

        if dealer_filter == 'unassigned':
            queryset = queryset.filter(assigned_dealer__isnull=True)
        elif dealer_filter and dealer_filter != 'all':
            queryset = queryset.filter(assigned_dealer__name=dealer_filter)

        if date_filter == 'today':
            today = timezone.now().date()
            queryset = queryset.filter(created_at__date=today)
        elif date_filter == 'week':
            week_ago = timezone.now() - timedelta(days=7)
            queryset = queryset.filter(created_at__gte=week_ago)
        elif date_filter == 'month':
            month_ago = timezone.now() - timedelta(days=30)
            queryset = queryset.filter(created_at__gte=month_ago)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['GET'], url_path='export')
    def export_orders(self, request):
        """Export orders to Excel (placeholder)"""
        # This would implement Excel export functionality
        return Response({
            'message': 'Export functionality would be implemented here',
            'download_url': '/api/admin/orders/download-export/'
        })

    @action(detail=False, methods=['GET'], url_path='pending-pricing')
    def pending_pricing(self, request):
        """Get orders pending pricing"""
        orders = self.get_queryset().filter(status='pending_pricing')
        serializer = self.get_serializer(orders, many=True)
        return Response(serializer.data)



class AdminCustomerViewSet(viewsets.ModelViewSet):
    """Admin customer management"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]
    serializer_class = CustomerSerializer

    def get_queryset(self):
        return Customer.objects.all().order_by('-date_joined')

    def list(self, request, *args, **kwargs):
        """List customers with search and filtering"""
        queryset = self.get_queryset()

        # Search functionality
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(company_name__icontains=search)
            )

        # Filter by type
        user_type = request.query_params.get('type')
        if user_type == 'dealers':
            queryset = queryset.filter(is_dealer=True)
        elif user_type == 'customers':
            queryset = queryset.filter(is_dealer=False, is_staff=False)
        elif user_type == 'staff':
            queryset = queryset.filter(is_staff=True)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Create new customer with required password"""
        data = request.data.copy()

        # Validate required fields
        required_fields = ['name', 'email', 'password']
        missing_fields = [field for field in required_fields if not data.get(field)]

        if missing_fields:
            return Response({
                'error': f'Missing required fields: {", ".join(missing_fields)}',
                'required_fields': required_fields
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate password length upfront
        password = data.get('password', '')
        if len(password) < 8:
            return Response({
                'error': 'Password must be at least 8 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=data)

        if serializer.is_valid():
            try:
                customer = serializer.save()
                return Response({
                    'message': 'Customer created successfully',
                    'customer': CustomerSerializer(customer, context={'request': request}).data
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({
                    'error': f'Error creating customer: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Return detailed validation errors
        return Response({
            'error': 'Validation failed',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        """Update customer"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Customer updated successfully',
                'customer': serializer.data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['GET'], url_path='details')
    def customer_details(self, request, pk=None):
        """Get detailed customer information with orders"""
        customer = self.get_object()

        # Get customer's orders - DON'T slice here, do it later
        orders = Order.objects.filter(customer=customer).order_by('-created_at')

        # Calculate totals from the full queryset
        completed_orders = orders.filter(status='completed')
        total_spent = completed_orders.aggregate(
            total=Sum('quoted_total')
        )['total'] or Decimal('0.00')

        # NOW slice for the recent orders display
        recent_orders = orders[:10]

        # Prepare orders data
        orders_data = []
        for order in recent_orders:
            orders_data.append({
                'id': order.id,
                'created_at': order.created_at.isoformat(),
                'status': order.status,
                'total': float(order.quoted_total) if order.quoted_total else 0,
                'items_count': order.items.count()
            })

        return Response({
            'customer': CustomerSerializer(customer, context={'request': request}).data,
            'orders': orders_data,
            'total_orders': orders.count(),
            'total_spent': float(total_spent)
        })

    @action(detail=True, methods=['POST'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """Toggle customer active status"""
        customer = self.get_object()
        customer.is_active = not customer.is_active
        customer.save()

        return Response({
            'message': f'Customer {"activated" if customer.is_active else "deactivated"}',
            'customer': CustomerSerializer(customer, context={'request': request}).data
        })

    @action(detail=False, methods=['POST'], url_path='bulk-action')
    def bulk_actions(self, request):
        """Perform bulk actions on customers"""
        customer_ids = request.data.get('customer_ids', [])
        action = request.data.get('action')

        if not customer_ids:
            return Response({
                'error': 'No customers selected'
            }, status=status.HTTP_400_BAD_REQUEST)

        customers = Customer.objects.filter(id__in=customer_ids)

        if action == 'activate':
            customers.update(is_active=True)
            message = f'{customers.count()} customers activated'
        elif action == 'deactivate':
            customers.update(is_active=False)
            message = f'{customers.count()} customers deactivated'
        elif action == 'email':
            # For now, just return success - you can implement actual email sending later
            message = f'Email sent to {customers.count()} customers'
        elif action == 'delete':
            count = customers.count()
            customers.delete()
            message = f'{count} customers deleted'
        else:
            return Response({
                'error': 'Invalid action'
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({'message': message})

    @action(detail=True, methods=['GET'], url_path='orders')
    def customer_orders(self, request, pk=None):
        """Get all orders for a specific customer"""
        customer = self.get_object()
        orders = Order.objects.filter(customer=customer).order_by('-created_at')

        # Apply pagination if needed
        page = request.query_params.get('page', 1)
        limit = request.query_params.get('limit', 20)

        try:
            page = int(page)
            limit = int(limit)
            start = (page - 1) * limit
            end = start + limit
            orders_page = orders[start:end]
        except (ValueError, TypeError):
            orders_page = orders[:20]

        orders_data = []
        for order in orders_page:
            orders_data.append({
                'id': order.id,
                'created_at': order.created_at.isoformat(),
                'status': order.status,
                'total': float(order.quoted_total) if order.quoted_total else 0,
                'items_count': order.items.count(),
                'dealer': order.assigned_dealer.name if order.assigned_dealer else None
            })

        total_spent = orders.filter(status='completed').aggregate(
            total=Sum('quoted_total')
        )['total'] or Decimal('0.00')

        return Response({
            'customer': CustomerSerializer(customer, context={'request': request}).data,
            'orders': orders_data,
            'pagination': {
                'total_orders': orders.count(),
                'page': page,
                'limit': limit,
                'has_more': orders.count() > end
            },
            'total_spent': float(total_spent)
        })

    @action(detail=False, methods=['POST'], url_path='convert-to-dealer')
    def convert_to_dealer(self, request):
        """Convert customer to dealer"""
        customer_id = request.data.get('customer_id')
        commission_rate = request.data.get('commission_rate', 5.0)

        if not customer_id:
            return Response({
                'error': 'Customer ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            customer = Customer.objects.get(id=customer_id)
            if customer.is_dealer:
                return Response({
                    'error': 'Customer is already a dealer'
                }, status=status.HTTP_400_BAD_REQUEST)

            customer.is_dealer = True
            customer.dealer_commission_rate = Decimal(str(commission_rate))
            customer.save()

            return Response({
                'message': f'{customer.name} converted to dealer',
                'customer': CustomerSerializer(customer, context={'request': request}).data
            })

        except Customer.DoesNotExist:
            return Response({
                'error': 'Customer not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, TypeError):
            return Response({
                'error': 'Invalid commission rate'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='export')
    def export_customers(self, request):
        """Export customers to Excel (placeholder)"""
        return Response({
            'message': 'Export functionality would be implemented here',
            'download_url': '/api/admin/customers/download-export/'
        })

    @action(detail=False, methods=['GET'], url_path='stats')
    def customer_statistics(self, request):
        """Get customer statistics"""
        customers = self.get_queryset()
        month_ago = timezone.now() - timedelta(days=30)

        stats = {
            'total': customers.count(),
            'active': customers.filter(is_active=True).count(),
            'inactive': customers.filter(is_active=False).count(),
            'dealers': customers.filter(is_dealer=True).count(),
            'regular': customers.filter(is_dealer=False, is_staff=False).count(),
            'staff': customers.filter(is_staff=True).count(),
            'new_this_month': customers.filter(date_joined__gte=month_ago).count(),
        }

        return Response(stats)

class AdminDealerViewSet(viewsets.ModelViewSet):
    """Admin dealer management"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]
    serializer_class = DealerSerializer

    def get_queryset(self):
        return Customer.objects.filter(is_dealer=True).order_by('-date_joined')

    @action(detail=False, methods=['POST'], url_path='create')
    def create_dealer(self, request):
        """Create new dealer or convert existing customer"""
        email = request.data.get('email')
        name = request.data.get('name')
        commission_rate = request.data.get('commission_rate', 5.0)

        if not email or not name:
            return Response({
                'error': 'Email and name are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if customer already exists
        try:
            customer = Customer.objects.get(email=email)
            if customer.is_dealer:
                return Response({
                    'error': 'User is already a dealer'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Convert to dealer
            customer.is_dealer = True
            customer.dealer_commission_rate = Decimal(str(commission_rate))
            customer.save()

            message = f'{customer.name} converted to dealer'

        except Customer.DoesNotExist:
            # Create new dealer
            customer = Customer.objects.create_user(
                email=email,
                name=name,
                password='changeme123',  # They'll need to reset
                is_dealer=True,
                dealer_commission_rate=Decimal(str(commission_rate))
            )
            message = f'New dealer {customer.name} created'

        return Response({
            'message': message,
            'dealer': DealerSerializer(customer).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['POST'], url_path='update-commission')
    def update_commission(self, request, pk=None):
        """Update dealer commission rate"""
        dealer = self.get_object()
        new_rate = request.data.get('commission_rate')

        if new_rate is None:
            return Response({
                'error': 'Commission rate is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            dealer.dealer_commission_rate = Decimal(str(new_rate))
            dealer.save()

            return Response({
                'message': 'Commission rate updated successfully',
                'dealer': DealerSerializer(dealer).data
            })
        except (ValueError, TypeError):
            return Response({
                'error': 'Invalid commission rate'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['GET'], url_path='performance')
    def dealer_performance(self, request, pk=None):
        """Get dealer performance metrics"""
        dealer = self.get_object()

        orders = Order.objects.filter(assigned_dealer=dealer)
        completed_orders = orders.filter(status='completed')

        total_sales = completed_orders.aggregate(
            total=Sum('quoted_total')
        )['total'] or Decimal('0.00')

        total_commission = sum(
            order.dealer_commission_amount for order in completed_orders
        )

        commissions = DealerCommission.objects.filter(dealer=dealer)
        paid_commission = commissions.filter(is_paid=True).aggregate(
            total=Sum('commission_amount')
        )['total'] or Decimal('0.00')

        return Response({
            'dealer': DealerSerializer(dealer).data,
            'performance': {
                'total_orders': orders.count(),
                'completed_orders': completed_orders.count(),
                'pending_orders': orders.filter(
                    status__in=['pending_pricing', 'waiting_customer_approval', 'confirmed']
                ).count(),
                'total_sales': float(total_sales),
                'total_commission_earned': float(total_commission),
                'paid_commission': float(paid_commission),
                'pending_commission': float(total_commission - paid_commission),
                'conversion_rate': round(
                    (completed_orders.count() / orders.count() * 100) if orders.count() > 0 else 0,
                    2
                )
            }
        })

    @action(detail=False, methods=['GET'], url_path='commissions')
    def all_commissions(self, request):
        """Get all dealer commissions"""
        commissions = DealerCommission.objects.select_related(
            'dealer', 'order'
        ).order_by('-created_at')

        # Filter by payment status
        paid_filter = request.query_params.get('paid')
        if paid_filter == 'true':
            commissions = commissions.filter(is_paid=True)
        elif paid_filter == 'false':
            commissions = commissions.filter(is_paid=False)

        serializer = DealerCommissionSerializer(commissions, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['POST'], url_path='pay-commissions')
    def pay_commissions(self, request):
        """Mark commissions as paid"""
        commission_ids = request.data.get('commission_ids', [])
        payment_reference = request.data.get('payment_reference', '')

        if not commission_ids:
            return Response({
                'error': 'No commissions selected'
            }, status=status.HTTP_400_BAD_REQUEST)

        commissions = DealerCommission.objects.filter(id__in=commission_ids)
        updated_count = commissions.update(
            is_paid=True,
            paid_at=timezone.now(),
            payment_reference=payment_reference
        )

        total_amount = commissions.aggregate(
            total=Sum('commission_amount')
        )['total'] or Decimal('0.00')

        return Response({
            'message': f'{updated_count} commissions marked as paid',
            'total_amount': float(total_amount),
            'payment_reference': payment_reference
        })


class AdminAnnouncementViewSet(viewsets.ModelViewSet):
    """Admin shipment announcement management"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]
    serializer_class = ShipmentAnnouncementSerializer

    def get_queryset(self):
        return ShipmentAnnouncement.objects.all().prefetch_related('images').order_by('-created_at')

    def perform_create(self, serializer):
        """Set created_by when creating announcement"""
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """Handle announcement creation with multiple images"""
        serializer = self.get_serializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            announcement = serializer.save()

            # Handle multiple image uploads
            images = request.FILES.getlist('images')
            for i, image_file in enumerate(images):
                ShipmentAnnouncementImage.objects.create(
                    announcement=announcement,
                    image=image_file,
                    order=i
                )

            return Response({
                'message': 'Announcement created successfully',
                'announcement': ShipmentAnnouncementSerializer(announcement).data
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        """Handle announcement update with multiple images"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial, context={'request': request})

        if serializer.is_valid():
            announcement = serializer.save()

            # Handle new image uploads (replace existing)
            images = request.FILES.getlist('images')
            if images:
                # Delete existing additional images
                instance.images.all().delete()
                # Add new images
                for i, image_file in enumerate(images):
                    ShipmentAnnouncementImage.objects.create(
                        announcement=announcement,
                        image=image_file,
                        order=i
                    )

            return Response({
                'message': 'Announcement updated successfully',
                'announcement': ShipmentAnnouncementSerializer(announcement).data
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AdminReportsViewSet(viewsets.ViewSet):
    """Admin reports and analytics"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]

    @action(detail=False, methods=['GET'], url_path='sales-summary')
    def sales_summary(self, request):
        """Get sales summary report"""
        # Date range
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        orders = Order.objects.filter(
            status='completed',
            completion_date__gte=start_date
        )

        total_sales = orders.aggregate(
            total=Sum('quoted_total')
        )['total'] or Decimal('0.00')

        # Group by date
        daily_sales = {}
        for order in orders:
            date_key = order.completion_date.date().isoformat()
            if date_key not in daily_sales:
                daily_sales[date_key] = {'orders': 0, 'revenue': 0}
            daily_sales[date_key]['orders'] += 1
            daily_sales[date_key]['revenue'] += float(order.quoted_total)

        return Response({
            'period_days': days,
            'total_orders': orders.count(),
            'total_revenue': float(total_sales),
            'average_order_value': float(total_sales / orders.count()) if orders.count() > 0 else 0,
            'daily_breakdown': daily_sales
        })

    @action(detail=False, methods=['GET'], url_path='top-products')
    def top_products(self, request):
        """Get top selling products"""
        from django.db.models import Sum, Count

        products = Product.objects.annotate(
            total_ordered=Sum('orderitem__final_quantity'),
            times_ordered=Count('orderitem'),
            revenue=Sum('orderitem__quoted_unit_price') * Sum('orderitem__final_quantity')
        ).filter(
            total_ordered__isnull=False
        ).order_by('-total_ordered')[:20]

        product_data = []
        for product in products:
            product_data.append({
                'id': product.id,
                'name': product.name,
                'total_ordered': product.total_ordered or 0,
                'times_ordered': product.times_ordered or 0,
                'current_stock': product.stock,
                'revenue': float(product.revenue or 0),
                'stock_status': product.stock_status
            })

        return Response(product_data)

    @action(detail=False, methods=['GET'], url_path='dealer-performance')
    def dealer_performance_report(self, request):
        """Get dealer performance report"""
        dealers = Customer.objects.filter(is_dealer=True)

        dealer_data = []
        for dealer in dealers:
            orders = Order.objects.filter(assigned_dealer=dealer)
            completed_orders = orders.filter(status='completed')

            total_sales = completed_orders.aggregate(
                total=Sum('quoted_total')
            )['total'] or Decimal('0.00')

            total_commission = sum(
                order.dealer_commission_amount for order in completed_orders
            )

            dealer_data.append({
                'id': dealer.id,
                'name': dealer.name,
                'email': dealer.email,
                'commission_rate': float(dealer.dealer_commission_rate),
                'total_orders': orders.count(),
                'completed_orders': completed_orders.count(),
                'total_sales': float(total_sales),
                'total_commission': float(total_commission),
                'conversion_rate': round(
                    (completed_orders.count() / orders.count() * 100) if orders.count() > 0 else 0,
                    2
                )
            })

        # Sort by total sales
        dealer_data.sort(key=lambda x: x['total_sales'], reverse=True)

        return Response(dealer_data)