from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from django.db.models import Q, Count, Sum, Max

from ..models import (
    Customer, Product, Order, OrderItem, Invoice,
    ShipmentAnnouncement, ProductCategory, DealerCommission, ShipmentAnnouncementImage
)
from ..serializers.customers import CustomerSerializer
from ..serializers.products import ProductSerializer, ShipmentAnnouncementSerializer
from ..serializers.orders import OrderDetailSerializer
from ..serializers.dealers import DealerSerializer, DealerCommissionSerializer
from rest_framework.pagination import PageNumberPagination
from ..services.notification_service import NotificationService
import logging
from ..serializers.customers import CustomerInvoiceInfoSerializer

logger = logging.getLogger(__name__)

class ProductPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'limit'
    max_page_size = 100

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
    """Admin product management with pagination and server-side filtering"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]
    serializer_class = ProductSerializer
    pagination_class = ProductPagination

    def get_queryset(self):
        queryset = Product.objects.all()

        # Apply server-side filters
        search = self.request.query_params.get('search')
        status = self.request.query_params.get('status')
        stock_filter = self.request.query_params.get('stock_filter')
        category = self.request.query_params.get('category')
        ordering = self.request.query_params.get('ordering')

        # Search filter
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(description__icontains=search) |
                Q(category__name__icontains=search) |
                Q(category__display_name__icontains=search)
            )

        # Status filter
        if status and status != 'all':
            if status == 'active':
                queryset = queryset.filter(is_active=True)
            elif status == 'inactive':
                queryset = queryset.filter(is_active=False)

        # Stock filter
        if stock_filter and stock_filter != 'all':
            if stock_filter == 'out_of_stock':
                queryset = queryset.filter(stock=0)
            elif stock_filter == 'low_stock':
                queryset = queryset.filter(stock__gt=0, stock__lte=50)
            elif stock_filter == 'in_stock':
                queryset = queryset.filter(stock__gt=10)

        # Category filter
        if category and category != 'all':
            try:
                category_id = int(category)
                queryset = queryset.filter(category_id=category_id)
            except (ValueError, TypeError):
                pass

        # Ordering
        if ordering:
            if ordering == 'newest':
                queryset = queryset.order_by('-created_at')
            elif ordering == 'oldest':
                queryset = queryset.order_by('created_at')
            elif ordering == 'name':
                queryset = queryset.order_by('name')
            elif ordering == 'price':
                queryset = queryset.order_by('-base_price')
            elif ordering == 'stock':
                queryset = queryset.order_by('-stock')
            else:
                queryset = queryset.order_by('-created_at')
        else:
            queryset = queryset.order_by('-created_at')

        return queryset


    def create(self, request, *args, **kwargs):
        """Create new product with multiple images support"""

        # Get images from request
        images = []
        seen_names = set()
        images_from_files = request.FILES.getlist('images')

        if images_from_files:
            for image_file in images_from_files:
                file_name = getattr(image_file, 'name', 'unnamed')
                if file_name not in seen_names:
                    images.append(image_file)
                    seen_names.add(file_name)

        if not images:
            return Response({
                'error': 'حداقل یک تصویر الزامی است'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate images
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        max_size = 5 * 1024 * 1024  # 5MB

        for image_file in images:
            if hasattr(image_file, 'content_type') and image_file.content_type:
                if image_file.content_type.lower() not in allowed_types:
                    return Response({
                        'error': f'فرمت فایل {getattr(image_file, "name", "image")} پشتیبانی نمی‌شود'
                    }, status=status.HTTP_400_BAD_REQUEST)

            if hasattr(image_file, 'size') and image_file.size > max_size:
                return Response({
                    'error': f'حجم فایل {getattr(image_file, "name", "image")} نباید بیشتر از 5MB باشد'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Create product data - EXCLUDE image field completely
        product_data = {}
        for key, value in request.data.items():
            if key not in ['images', 'image_order', 'image']:
                product_data[key] = value

        serializer = self.get_serializer(data=product_data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Create product WITHOUT setting product.image
        product = serializer.save()

        # Handle image ordering
        image_order_data = None
        if 'image_order' in request.data:
            try:
                image_order_str = request.data.get('image_order')
                if isinstance(image_order_str, str):
                    import json
                    image_order_data = json.loads(image_order_str)
            except Exception:
                pass  # Ignore parsing errors

        # Create ProductImage objects ONLY
        created_images = []
        for i, image_file in enumerate(images):
            try:
                order = i
                is_primary = (i == 0)  # First image is primary

                # Use image order data if available
                if image_order_data:
                    for order_item in image_order_data:
                        if order_item.get('type') == 'new' and order_item.get('order', 0) == i:
                            order = order_item.get('order', i)
                            is_primary = order_item.get('is_primary', i == 0)
                            break

                # Create ONLY ProductImage - DON'T touch Product.image
                from tasks.models import ProductImage
                product_image = ProductImage.objects.create(
                    product=product,
                    image=image_file,
                    order=order,
                    is_primary=is_primary,
                    alt_text=f"تصویر {i + 1} برای {product.name}"
                )
                created_images.append(product_image)

            except Exception:
                continue  # Skip failed images

        return Response({
            'message': 'Product created successfully',
            'product': ProductSerializer(product, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update product with multiple images support"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Handle existing images to keep
        existing_images_to_keep = request.data.get('existing_images')
        if existing_images_to_keep:
            try:
                if isinstance(existing_images_to_keep, str):
                    import json
                    existing_images_to_keep = json.loads(existing_images_to_keep)
            except Exception:
                existing_images_to_keep = []

        # Handle new images if provided
        new_images = []
        images_from_files = request.FILES.getlist('images')
        if images_from_files:
            new_images.extend(images_from_files)

        # Update product fields (excluding images)
        product_data = request.data.copy()
        product_data.pop('images', None)
        product_data.pop('existing_images', None)
        product_data.pop('image_order', None)

        serializer = self.get_serializer(instance, data=product_data, partial=partial)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        product = serializer.save()

        # Handle images if new images provided or existing images management
        if new_images or existing_images_to_keep is not None:
            from tasks.models import ProductImage
            import os

            def extract_base_filename(url):
                """Extract base filename for matching, removing _comp suffix and normalizing case"""
                if not url:
                    return None
                filename = os.path.basename(url)
                # Remove _comp suffix if present
                if '_comp.' in filename:
                    base, ext = filename.rsplit('_comp.', 1)
                    filename = f"{base}.{ext}"
                # Remove file extension and normalize
                base_name = os.path.splitext(filename)[0].lower()
                return base_name

            # If we have existing images to keep, remove others
            if existing_images_to_keep is not None:
                # Extract base filenames from URLs that should be kept
                keep_filenames = set()
                for url in existing_images_to_keep:
                    base_filename = extract_base_filename(url)
                    if base_filename:
                        keep_filenames.add(base_filename)

                # Find images to keep and delete others
                current_images = product.images.all()
                images_to_delete = []

                for img in current_images:
                    if img.image:
                        img_base_filename = extract_base_filename(img.image.url)
                        if img_base_filename not in keep_filenames:
                            images_to_delete.append(img)

                # Delete marked images
                for img in images_to_delete:
                    img.delete()

            # Handle image ordering if provided
            if 'image_order' in request.data:
                try:
                    image_order_data = request.data.get('image_order')
                    if isinstance(image_order_data, str):
                        import json
                        image_order_data = json.loads(image_order_data)

                    # Reset all images to not primary first
                    product.images.update(is_primary=False)

                    # Update order and primary status based on filenames
                    for order_item in image_order_data:
                        if order_item.get('type') == 'existing' and order_item.get('src'):
                            target_base_filename = extract_base_filename(order_item['src'])

                            # Find ProductImage by filename match
                            for img in product.images.all():
                                if img.image:
                                    img_base_filename = extract_base_filename(img.image.url)
                                    if img_base_filename == target_base_filename:
                                        img.order = order_item.get('order', 0)
                                        img.is_primary = order_item.get('is_primary', False)
                                        img.save()
                                        break

                except Exception:
                    pass  # Ignore ordering errors

            # Add new images if provided
            if new_images:
                # Get current max order
                from django.db.models import Max
                current_max_order = product.images.aggregate(
                    max_order=Max('order')
                )['max_order'] or -1

                for i, image_file in enumerate(new_images):
                    try:
                        ProductImage.objects.create(
                            product=product,
                            image=image_file,
                            order=current_max_order + i + 1,
                            is_primary=False,  # Don't auto-set as primary for updates
                            alt_text=f"تصویر {current_max_order + i + 2} برای {product.name}"
                        )
                    except Exception:
                        continue  # Skip failed images

        # Refresh product from database
        product.refresh_from_db()

        return Response({
            'message': 'Product updated successfully',
            'product': ProductSerializer(product, context={'request': request}).data
        }, status=status.HTTP_200_OK)


    @action(detail=True, methods=['DELETE'], url_path='remove-image/(?P<image_id>[^/.]+)')
    def remove_image(self, request, pk=None, image_id=None):
        """Remove a specific image from a product"""
        product = self.get_object()

        try:
            from tasks.models import ProductImage
            image = ProductImage.objects.get(id=image_id, product=product)

            # If removing primary image, set another as primary
            if image.is_primary:
                next_primary = product.images.exclude(id=image.id).first()
                if next_primary:
                    next_primary.is_primary = True
                    next_primary.save()

            image.delete()

            return Response({
                'message': 'Image deleted successfully',
                'product': ProductSerializer(product, context={'request': request}).data
            })

        except ProductImage.DoesNotExist:
            return Response({
                'error': 'Image not found'
            }, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['POST'], url_path='reorder-images')
    def reorder_images(self, request, pk=None):
        """Reorder product images"""
        product = self.get_object()
        image_order = request.data.get('image_order', [])

        if not image_order:
            return Response({
                'error': 'image_order is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            from tasks.models import ProductImage

            for index, image_id in enumerate(image_order):
                ProductImage.objects.filter(
                    id=image_id,
                    product=product
                ).update(order=index)

            return Response({
                'message': 'Images reordered successfully',
                'product': ProductSerializer(product, context={'request': request}).data
            })

        except Exception as e:
            return Response({
                'error': f'Error reordering images: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['POST'], url_path='set-primary-image/(?P<image_id>[^/.]+)')
    def set_primary_image(self, request, pk=None, image_id=None):
        """Set a specific image as primary"""
        product = self.get_object()

        try:
            from tasks.models import ProductImage

            # Remove primary from all images
            product.images.update(is_primary=False)

            # Set new primary
            image = ProductImage.objects.get(id=image_id, product=product)
            image.is_primary = True
            image.save()

            return Response({
                'message': 'Primary image set successfully',
                'product': ProductSerializer(product, context={'request': request}).data
            })

        except ProductImage.DoesNotExist:
            return Response({
                'error': 'Image not found'
            }, status=status.HTTP_404_NOT_FOUND)

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

    @action(detail=False, methods=['POST'],url_path='bulk-actions')
    def bulk_actions(self, request):
        """Perform bulk actions on products - FIXED endpoint name"""
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

    # Add stats endpoint for the statistics cards
    @action(detail=False, methods=['GET'], url_path='stats')
    def get_stats(self, request):
        """Get product statistics for the dashboard"""
        queryset = self.get_queryset()

        # Get filtered stats based on current filters
        total = queryset.count()
        active = queryset.filter(is_active=True).count()
        inactive = queryset.filter(is_active=False).count()
        low_stock = queryset.filter(stock__gt=0, stock__lte=50).count()
        out_of_stock = queryset.filter(stock=0).count()
        featured = queryset.filter(is_featured=True).count()

        # Calculate total value
        total_value = sum(
            (product.base_price or 0) * (product.stock or 0)
            for product in queryset
        )

        return Response({
            'total': total,
            'active': active,
            'inactive': inactive,
            'low_stock': low_stock,
            'out_of_stock': out_of_stock,
            'featured': featured,
            'total_value': total_value
        })


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

    @action(detail=True, methods=['GET'], url_path='customer-info')
    def get_customer_info(self, request, pk=None):
        """Get customer invoice info for an order"""
        try:
            order = self.get_object()
            customer = order.customer

            from ..serializers.customers import CustomerInvoiceInfoSerializer
            serializer = CustomerInvoiceInfoSerializer(customer)

            return Response({
                'customer_info': serializer.data,
                'has_complete_info': self._check_complete_info(customer),
                'missing_fields': self._get_missing_fields(customer)
            })

        except Exception as e:
            logger.error(f"❌ Error fetching customer info for admin: {str(e)}")
            return Response(
                {'error': 'خطا در دریافت اطلاعات مشتری'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _check_complete_info(self, customer):
        """Check if customer info is complete for invoice"""
        required_fields = ['national_id', 'complete_address', 'postal_code']
        return all(getattr(customer, field, None) for field in required_fields)

    def _get_missing_fields(self, customer):
        """Get list of missing required fields"""
        required_fields = ['national_id', 'complete_address', 'postal_code']
        return [field for field in required_fields if not getattr(customer, field, None)]

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

    @action(detail=True, methods=['GET'], url_path='details')
    def order_details(self, request, pk=None):
        """Get detailed order information"""
        try:
            # pk is already an integer, so just get the order directly
            order = self.get_object()
        except Order.DoesNotExist:
            return Response({
                'error': 'Order not found'
            }, status=status.HTTP_404_NOT_FOUND)

        commission = DealerCommission.objects.filter(order=order).first()

        # FIXED: Use correct field names
        order_amount = 0
        if hasattr(order, 'quoted_total') and order.quoted_total:
            order_amount = float(order.quoted_total)
        elif hasattr(order, 'total') and order.total:
            order_amount = float(order.total)
        elif hasattr(order, 'get_total'):
            order_amount = float(order.get_total())

        # FIXED: Handle OrderItem attributes properly
        items_data = []
        for item in order.items.all():
            quantity = 1  # fallback
            if hasattr(item, 'final_quantity') and item.final_quantity:
                quantity = item.final_quantity
            elif hasattr(item, 'requested_quantity') and item.requested_quantity:
                quantity = item.requested_quantity

            unit_price = 0
            if hasattr(item, 'quoted_unit_price') and item.quoted_unit_price:
                unit_price = float(item.quoted_unit_price)
            elif hasattr(item, 'unit_price') and item.unit_price:
                unit_price = float(item.unit_price)
            elif hasattr(item, 'price') and item.price:
                unit_price = float(item.price)

            items_data.append({
                'product_name': item.product.name,
                'quantity': quantity,
                'unit_price': unit_price,
                'total_price': float(unit_price * quantity)
            })

        return Response({
            'id': order.order_code if hasattr(order, 'order_code') else f"ORD-{order.id}",
            'customer': {
                'name': order.customer.name,
                'email': order.customer.email
            },
            'date': order.created_at.date(),
            'total_amount': order_amount,
            'status': order.status,
            'items': items_data,
            'commission': {
                'rate': float(commission.commission_rate) if commission else 0,
                'amount': float(commission.commission_amount) if commission else 0,
                'is_paid': commission.is_paid if commission else False
            } if commission else None
        })

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
        """Get specific customer's orders for a dealer"""
        customer = self.get_object()
        dealer_id = request.query_params.get('dealer_id')

        orders = Order.objects.filter(customer=customer)
        if dealer_id:
            orders = orders.filter(assigned_dealer_id=dealer_id)

        orders = orders.order_by('-created_at')

        order_data = []
        for order in orders:
            # FIXED: Use correct field names
            order_amount = 0
            if hasattr(order, 'quoted_total') and order.quoted_total:
                order_amount = float(order.quoted_total)
            elif hasattr(order, 'total') and order.total:
                order_amount = float(order.total)
            elif hasattr(order, 'get_total'):
                order_amount = float(order.get_total())

            # FIXED: Handle OrderItem attributes properly - check what fields actually exist
            items_data = []
            for item in order.items.all():
                # Debug: Print available attributes
                print(f"OrderItem attributes: {[attr for attr in dir(item) if not attr.startswith('_')]}")

                # Try different possible quantity field names
                quantity = 1  # fallback
                if hasattr(item, 'final_quantity') and item.final_quantity:
                    quantity = item.final_quantity
                elif hasattr(item, 'requested_quantity') and item.requested_quantity:
                    quantity = item.requested_quantity
                # Remove the problematic 'quantity' check since it doesn't exist

                # Try different possible price field names
                unit_price = 0
                if hasattr(item, 'quoted_unit_price') and item.quoted_unit_price:
                    unit_price = float(item.quoted_unit_price)
                elif hasattr(item, 'unit_price') and item.unit_price:
                    unit_price = float(item.unit_price)
                elif hasattr(item, 'price') and item.price:
                    unit_price = float(item.price)

                items_data.append({
                    'product_name': item.product.name,
                    'quantity': quantity,
                    'unit_price': unit_price,
                    'total_price': float(unit_price * quantity)
                })

            order_data.append({
                'id': order.order_code if hasattr(order, 'order_code') else f"ORD-{order.id}",
                'date': order.created_at.date(),
                'total_amount': order_amount,
                'status': order.status,
                'items': items_data
            })

        return Response({
            'results': order_data
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
        """ENHANCED: Mark commissions as paid with email notifications"""
        commission_ids = request.data.get('commission_ids', [])
        payment_reference = request.data.get('payment_reference', '')

        if not commission_ids:
            return Response({
                'error': 'No commissions selected'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Get commissions and group by dealer
            commissions = DealerCommission.objects.filter(
                id__in=commission_ids,
                is_paid=False  # Only pay unpaid commissions
            ).select_related('dealer', 'order')

            if not commissions.exists():
                return Response({
                    'error': 'No unpaid commissions found with provided IDs'
                }, status=status.HTTP_404_NOT_FOUND)

            # Group commissions by dealer
            from collections import defaultdict
            dealer_commissions = defaultdict(list)

            for commission in commissions:
                dealer_commissions[commission.dealer].append(commission)

            # Mark commissions as paid
            updated_count = commissions.update(
                is_paid=True,
                paid_at=timezone.now(),
                payment_reference=payment_reference
            )

            # Calculate total amount
            total_amount = commissions.aggregate(
                total=Sum('commission_amount')
            )['total'] or Decimal('0.00')

            # NEW: Send email notifications to each dealer
            email_results = {}
            for dealer, dealer_commission_list in dealer_commissions.items():
                try:
                    # Refresh commissions from DB to get updated paid_at timestamps
                    updated_commissions = DealerCommission.objects.filter(
                        id__in=[c.id for c in dealer_commission_list]
                    )

                    email_sent = NotificationService.notify_dealer_commission_paid(
                        dealer=dealer,
                        commissions_list=updated_commissions,
                        payment_reference=payment_reference
                    )

                    dealer_total = sum(c.commission_amount for c in dealer_commission_list)
                    email_results[dealer.email] = {
                        'email_sent': email_sent,
                        'amount': float(dealer_total),
                        'commissions_count': len(dealer_commission_list)
                    }

                    if email_sent:
                        print(f"📧 Commission payment notification sent to {dealer.email} - Amount: {dealer_total}")
                    else:
                        print(f"❌ Failed to send commission payment notification to {dealer.email}")

                except Exception as e:
                    print(f"❌ Error sending commission notification to {dealer.email}: {e}")
                    email_results[dealer.email] = {
                        'email_sent': False,
                        'error': str(e),
                        'amount': float(sum(c.commission_amount for c in dealer_commission_list)),
                        'commissions_count': len(dealer_commission_list)
                    }

            return Response({
                'message': f'{updated_count} commissions marked as paid',
                'total_amount': float(total_amount),
                'payment_reference': payment_reference,
                'dealers_notified': len(dealer_commissions),
                'email_notifications': email_results
            })

        except Exception as e:
            return Response({
                'error': f'Error processing commission payments: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['POST'], url_path='pay-dealer-commissions')
    def pay_dealer_commissions(self, request, pk=None):
        """NEW: Pay all unpaid commissions for a specific dealer"""
        dealer = self.get_object()
        payment_reference = request.data.get('payment_reference',
                                             f'DEALER-PAY-{timezone.now().strftime("%Y%m%d-%H%M%S")}')

        try:
            # Get all unpaid commissions for this dealer
            unpaid_commissions = DealerCommission.objects.filter(
                dealer=dealer,
                is_paid=False
            ).select_related('order')

            if not unpaid_commissions.exists():
                return Response({
                    'message': f'No unpaid commissions found for dealer {dealer.name}',
                    'dealer': DealerSerializer(dealer).data
                })

            # Calculate total
            total_amount = unpaid_commissions.aggregate(
                total=Sum('commission_amount')
            )['total'] or Decimal('0.00')

            # Mark as paid
            updated_count = unpaid_commissions.update(
                is_paid=True,
                paid_at=timezone.now(),
                payment_reference=payment_reference
            )

            # Refresh commissions from DB to get updated timestamps
            paid_commissions = DealerCommission.objects.filter(
                dealer=dealer,
                payment_reference=payment_reference
            )

            # Send email notification
            email_sent = NotificationService.notify_dealer_commission_paid(
                dealer=dealer,
                commissions_list=paid_commissions,
                payment_reference=payment_reference
            )

            return Response({
                'message': f'{updated_count} commissions paid to {dealer.name}',
                'dealer': DealerSerializer(dealer).data,
                'total_amount': float(total_amount),
                'payment_reference': payment_reference,
                'email_notification_sent': email_sent,
                'commissions_details': [
                    {
                        'order_id': c.order.id,
                        'amount': float(c.commission_amount),
                        'rate': float(c.commission_rate)
                    } for c in paid_commissions
                ]
            })

        except Exception as e:
            return Response({
                'error': f'Error paying dealer commissions: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Add these imports at the top of your admin.py file
    from datetime import datetime
    from django.db.models import Avg

    # Add these methods to your existing AdminDealerViewSet class:

    @action(detail=True, methods=['GET'], url_path='performance')
    def performance(self, request, pk=None):
        """Get comprehensive dealer performance data"""
        dealer = self.get_object()

        # Calculate performance metrics
        orders = Order.objects.filter(assigned_dealer=dealer)
        completed_orders = orders.filter(status='completed')

        # FIXED: Use the correct field name for order total
        total_sales = completed_orders.aggregate(
            total=Sum('quoted_total')
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

        # Calculate customer retention (simplified - you may want to refine this logic)
        unique_customers = orders.values('customer').distinct().count()
        repeat_customers = orders.values('customer').annotate(
            order_count=Count('id')
        ).filter(order_count__gt=1).count()

        customer_retention = 0
        if unique_customers > 0:
            customer_retention = (repeat_customers / unique_customers) * 100

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
                'customer_retention_rate': round(customer_retention, 1)
            }
        })

    @action(detail=True, methods=['GET'], url_path='customers')
    def top_customers(self, request, pk=None):
        """Get dealer's top customers with search and sort"""
        dealer = self.get_object()
        search = request.query_params.get('search', '')
        sort_by = request.query_params.get('sort_by', 'total_spent')
        order = request.query_params.get('order', 'desc')

        # FIXED: Use the correct relationship field name
        # Get customers who have orders with this dealer
        customer_stats = []

        # Get all orders for this dealer and extract unique customers
        dealer_orders = Order.objects.filter(assigned_dealer=dealer)
        customer_ids = dealer_orders.values_list('customer_id', flat=True).distinct()
        customers = Customer.objects.filter(id__in=customer_ids)

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

            # FIXED: Use the correct field name for order total
            total_spent = completed_orders.aggregate(
                total=Sum('quoted_total')
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

            # FIXED: Use the correct field names for order amount
            order_amount = 0
            if hasattr(order, 'quoted_total') and order.quoted_total:
                order_amount = float(order.quoted_total)
            elif hasattr(order, 'total') and order.total:
                order_amount = float(order.total)
            elif hasattr(order, 'get_total'):
                order_amount = float(order.get_total())

            order_data.append({
                'id': order.order_code if hasattr(order, 'order_code') else f"ORD-{order.id}",
                'customer_name': order.customer.name,
                'amount': order_amount,
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
        dealer = self.get_object()
        year = int(request.query_params.get('year', 2024))

        # Get last 6 months of data
        monthly_data = []
        persian_months = [
            'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
            'مرداد', 'شهریور', 'مهر', 'آبان',
            'آذر', 'دی', 'بهمن', 'اسفند'
        ]

        # Calculate for last 6 months from current date
        current_date = timezone.now()
        for i in range(6):
            # Calculate month boundaries
            if current_date.month - i > 0:
                target_month = current_date.month - i
                target_year = current_date.year
            else:
                target_month = 12 + (current_date.month - i)
                target_year = current_date.year - 1

            # Get orders for this month
            month_orders = Order.objects.filter(
                assigned_dealer=dealer,
                status='completed',
                created_at__year=target_year,
                created_at__month=target_month
            )

            month_sales = month_orders.aggregate(
                total=Sum('quoted_total')
            )['total'] or Decimal('0.00')

            month_commissions = DealerCommission.objects.filter(
                dealer=dealer,
                order__in=month_orders
            )

            month_commission = month_commissions.aggregate(
                total=Sum('commission_amount')
            )['total'] or Decimal('0.00')

            monthly_data.insert(0, {  # Insert at beginning to maintain chronological order
                'month': persian_months[(target_month - 1) % 12],
                'orders': month_orders.count(),
                'sales': float(month_sales),
                'commission': float(month_commission)
            })

        return Response({
            'monthly_stats': monthly_data
        })


class AdminAnnouncementViewSet(viewsets.ModelViewSet):
    """Admin-specific ViewSet for shipment announcements with proper field names"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]
    serializer_class = ShipmentAnnouncementSerializer

    def get_queryset(self):
        """FIXED: Use correct prefetch_related with 'additional_images'"""
        return ShipmentAnnouncement.objects.select_related('created_by').prefetch_related('additional_images').order_by(
            '-created_at')

    def create(self, request, *args, **kwargs):
        """Create announcement with file upload support"""
        try:
            # Extract and validate images
            images = request.FILES.getlist('images')

            # Validate image files
            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
            max_size = 5 * 1024 * 1024  # 5MB

            for image in images:
                if image.content_type not in allowed_types:
                    return Response({
                        'error': f'فرمت فایل {image.name} پشتیبانی نمی‌شود. فقط JPEG, PNG, GIF, WebP مجاز هستند.'
                    }, status=status.HTTP_400_BAD_REQUEST)

                if image.size > max_size:
                    return Response({
                        'error': f'حجم فایل {image.name} بیش از 5MB است.'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Convert boolean strings to actual booleans
            is_active = str(request.data.get('is_active', 'true')).lower() in ['true', '1', 'yes']
            is_featured = str(request.data.get('is_featured', 'false')).lower() in ['true', '1', 'yes']

            # Clean up date fields
            shipment_date = request.data.get('shipment_date')
            if shipment_date == '':
                shipment_date = None

            estimated_arrival = request.data.get('estimated_arrival')
            if estimated_arrival == '':
                estimated_arrival = None

            # Validate required fields
            title = request.data.get('title', '').strip()
            description = request.data.get('description', '').strip()

            if not title:
                return Response({
                    'error': 'عنوان اطلاعیه الزامی است'
                }, status=status.HTTP_400_BAD_REQUEST)

            if not description:
                return Response({
                    'error': 'توضیحات الزامی است'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create announcement directly using Django ORM
            announcement = ShipmentAnnouncement.objects.create(
                title=title,
                description=description,
                origin_country=request.data.get('origin_country', '').strip(),
                shipment_date=shipment_date,
                estimated_arrival=estimated_arrival,
                product_categories=request.data.get('product_categories', '').strip(),
                is_active=is_active,
                is_featured=is_featured,
                created_by=request.user
            )

            # Handle images if provided
            if images:
                # Set first image as main image
                announcement.image = images[0]
                announcement.save()

                # FIXED: Handle additional images using correct model and field names
                for i, image_file in enumerate(images[1:], start=1):
                    ShipmentAnnouncementImage.objects.create(
                        announcement=announcement,
                        image=image_file,
                        order=i,
                        alt_text=f"Image {i + 1} for {announcement.title}"
                    )

            # Return success response using the serializer for output only
            serializer = self.get_serializer(announcement)
            return Response({
                'message': 'Announcement created successfully',
                'announcement': serializer.data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'error': f'خطا در ایجاد اطلاعیه: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, *args, **kwargs):
        """Update announcement with file upload support"""
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()

            # Extract and validate images if provided
            images = request.FILES.getlist('images')

            if images:
                # Validate image files
                allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
                max_size = 5 * 1024 * 1024  # 5MB

                for image in images:
                    if image.content_type not in allowed_types:
                        return Response({
                            'error': f'فرمت فایل {image.name} پشتیبانی نمی‌شود. فقط JPEG, PNG, GIF, WebP مجاز هستند.'
                        }, status=status.HTTP_400_BAD_REQUEST)

                    if image.size > max_size:
                        return Response({
                            'error': f'حجم فایل {image.name} بیش از 5MB است.'
                        }, status=status.HTTP_400_BAD_REQUEST)

            # Update fields directly on the instance
            if 'title' in request.data:
                title = request.data.get('title', '').strip()
                if not title:
                    return Response({
                        'error': 'عنوان اطلاعیه الزامی است'
                    }, status=status.HTTP_400_BAD_REQUEST)
                instance.title = title

            if 'description' in request.data:
                description = request.data.get('description', '').strip()
                if not description:
                    return Response({
                        'error': 'توضیحات الزامی است'
                    }, status=status.HTTP_400_BAD_REQUEST)
                instance.description = description

            if 'origin_country' in request.data:
                instance.origin_country = request.data.get('origin_country', '').strip()

            if 'product_categories' in request.data:
                instance.product_categories = request.data.get('product_categories', '').strip()

            if 'shipment_date' in request.data:
                shipment_date = request.data.get('shipment_date')
                instance.shipment_date = None if shipment_date == '' else shipment_date

            if 'estimated_arrival' in request.data:
                estimated_arrival = request.data.get('estimated_arrival')
                instance.estimated_arrival = None if estimated_arrival == '' else estimated_arrival

            if 'is_active' in request.data:
                instance.is_active = str(request.data.get('is_active', 'true')).lower() in ['true', '1', 'yes']

            if 'is_featured' in request.data:
                instance.is_featured = str(request.data.get('is_featured', 'false')).lower() in ['true', '1', 'yes']

            # Save the updated instance
            instance.save()

            # Handle image updates if new images provided
            if images:
                # FIXED: Clear existing additional images using correct related name
                instance.additional_images.all().delete()

                # Set first image as main image
                instance.image = images[0]
                instance.save()

                # FIXED: Add additional images using correct model and field names
                for i, image_file in enumerate(images[1:], start=1):
                    ShipmentAnnouncementImage.objects.create(
                        announcement=instance,
                        image=image_file,
                        order=i,
                        alt_text=f"Image {i + 1} for {instance.title}"
                    )

            # Return success response using the serializer for output only
            serializer = self.get_serializer(instance)
            return Response({
                'message': 'Announcement updated successfully',
                'announcement': serializer.data
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({
                'error': f'خطا در به‌روزرسانی اطلاعیه: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def list(self, request, *args, **kwargs):
        """List all announcements for admin"""
        announcements = self.get_queryset()
        serializer = self.get_serializer(announcements, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['POST'], url_path='bulk-action')
    def bulk_action(self, request):
        """Perform bulk actions on announcements"""
        action = request.data.get('action')
        announcement_ids = request.data.get('announcement_ids', [])

        if not action or not announcement_ids:
            return Response({
                'error': 'Action and announcement_ids are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        announcements = ShipmentAnnouncement.objects.filter(id__in=announcement_ids)
        if not announcements.exists():
            return Response({
                'error': 'No announcements found with provided IDs'
            }, status=status.HTTP_404_NOT_FOUND)

        updated_count = 0
        try:
            if action == 'activate':
                updated_count = announcements.update(is_active=True)
            elif action == 'deactivate':
                updated_count = announcements.update(is_active=False)
            elif action == 'delete':
                updated_count = announcements.count()
                announcements.delete()
            else:
                return Response({
                    'error': f'Unknown action: {action}'
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                'message': f'Bulk {action} completed successfully',
                'updated_count': updated_count
            })

        except Exception as e:
            return Response({
                'error': f'Error performing bulk action: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['GET'], url_path='analytics')
    def analytics(self, request):
        """Get announcement analytics"""
        try:
            announcements = self.get_queryset()

            # Basic stats
            total = announcements.count()
            active = announcements.filter(is_active=True).count()
            inactive = announcements.filter(is_active=False).count()
            featured = announcements.filter(is_featured=True).count()

            # This month stats
            from datetime import datetime
            now = datetime.now()
            this_month = announcements.filter(
                created_at__year=now.year,
                created_at__month=now.month
            ).count()

            # Total views
            total_views = announcements.aggregate(
                total=Sum('view_count')
            )['total'] or 0

            return Response({
                'total': total,
                'active': active,
                'inactive': inactive,
                'featured': featured,
                'this_month': this_month,
                'total_views': total_views
            })

        except Exception as e:
            return Response({
                'error': f'Analytics failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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

