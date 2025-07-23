# tasks/views/products.py - Updated version with new features
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone
from django.db.models import Q, Avg
from datetime import timedelta
from ..serializers import ProductSerializer
from ..models import Product, ShipmentAnnouncement, ProductCategory


class ProductViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'new_arrivals', 'categories', 'search']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            # Admin sees all products including inactive ones
            return Product.objects.all().order_by('-created_at')
        else:
            # Regular users see only active products
            return Product.objects.filter(is_active=True).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Admin creates a new product with image upload support"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        # Handle image upload
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            # Generate SKU if not provided
            if not serializer.validated_data.get('sku'):
                sku = f"PRD-{timezone.now().strftime('%Y%m%d')}-{Product.objects.count() + 1:04d}"
                serializer.validated_data['sku'] = sku

            product = serializer.save()

            return Response({
                'message': 'Product created successfully',
                'product': ProductSerializer(product).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            'error': 'Invalid data',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        """Admin updates product with image upload support"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)

        if serializer.is_valid():
            product = serializer.save()
            return Response({
                'message': 'Product updated successfully',
                'product': ProductSerializer(product).data
            }, status=status.HTTP_200_OK)

        return Response({
            'error': 'Invalid data',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='admin-view')
    def admin_view(self, request):
        """Get all products for admin management"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        products = Product.objects.all().order_by('-created_at')

        # Add stock status and other admin-specific info
        product_data = []
        for product in products:
            data = ProductSerializer(product).data
            data.update({
                'is_low_stock': product.is_low_stock,
                'days_since_created': (timezone.now() - product.created_at).days,
                'orders_count': product.orderitem_set.count(),
                'revenue_generated': sum(
                    item.total_price for item in product.orderitem_set.filter(
                        order__status='completed'
                    )
                )
            })
            product_data.append(data)

        return Response(product_data)

    @action(detail=False, methods=['GET'], url_path='new-arrivals')
    def new_arrivals(self, request):
        """Get products added in the last 30 days"""
        days = int(request.query_params.get('days', 30))
        products = Product.get_new_arrivals(days=days)

        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['GET'], url_path='low-stock')
    def low_stock(self, request):
        """Get products with low stock (admin only)"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        products = Product.get_low_stock_products()
        serializer = self.get_serializer(products, many=True)

        return Response({
            'count': products.count(),
            'products': serializer.data
        })

    @action(detail=False, methods=['GET'])
    def search(self, request):
        """Search products by name, description, or tags"""
        query = request.query_params.get('q', '').strip()
        category_id = request.query_params.get('category')

        if not query and not category_id:
            return Response({
                'error': 'Search query or category required'
            }, status=status.HTTP_400_BAD_REQUEST)

        products = self.get_queryset()

        if query:
            products = products.filter(
                Q(name__icontains=query) |
                Q(description__icontains=query) |
                Q(tags__icontains=query)
            )

        if category_id:
            products = products.filter(category_id=category_id)

        # Sort by relevance (could be improved with search ranking)
        products = products.order_by('-created_at')[:50]  # Limit results

        serializer = self.get_serializer(products, many=True)
        return Response({
            'query': query,
            'count': len(serializer.data),
            'products': serializer.data
        })

    @action(detail=True, methods=['POST'], url_path='update-stock')
    def update_stock(self, request, pk=None):
        """Update product stock level (admin only)"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        product = self.get_object()
        new_stock = request.data.get('stock')

        if new_stock is None:
            return Response({
                'error': 'Stock value required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_stock = int(new_stock)
            if new_stock < 0:
                return Response({
                    'error': 'Stock cannot be negative'
                }, status=status.HTTP_400_BAD_REQUEST)

            old_stock = product.stock
            product.stock = new_stock
            product.save()

            return Response({
                'message': 'Stock updated successfully',
                'product_id': product.id,
                'old_stock': old_stock,
                'new_stock': new_stock,
                'is_low_stock': product.is_low_stock
            })

        except ValueError:
            return Response({
                'error': 'Invalid stock value'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['POST'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        """Toggle product active status (admin only)"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        product = self.get_object()
        product.is_active = not product.is_active
        product.save()

        return Response({
            'message': f'Product {"activated" if product.is_active else "deactivated"} successfully',
            'product_id': product.id,
            'is_active': product.is_active
        })

    @action(detail=False, methods=['GET'])
    def categories(self, request):
        """Get all product categories"""
        categories = ProductCategory.objects.filter(is_active=True).order_by('order', 'name')

        category_data = []
        for category in categories:
            category_data.append({
                'id': category.id,
                'name': category.name,
                'description': category.description,
                'image_url': category.image.url if category.image else None,
                'products_count': category.products_count,
                'parent_id': category.parent_id,
                'subcategories': [
                    {
                        'id': sub.id,
                        'name': sub.name,
                        'products_count': sub.products_count
                    } for sub in category.subcategories.filter(is_active=True)
                ]
            })

        return Response(category_data)

    @action(detail=True, methods=['GET'])
    def reviews(self, request, pk=None):
        """Get product reviews"""
        product = self.get_object()
        reviews = product.reviews.filter(is_approved=True).order_by('-created_at')

        reviews_data = []
        for review in reviews:
            reviews_data.append({
                'id': review.id,
                'customer_name': review.customer.name,
                'rating': review.rating,
                'title': review.title,
                'comment': review.comment,
                'is_verified_purchase': review.is_verified_purchase,
                'created_at': review.created_at
            })

        return Response({
            'product_id': product.id,
            'average_rating': product.average_rating,
            'total_reviews': product.reviews_count,
            'reviews': reviews_data
        })


class ShipmentAnnouncementViewSet(viewsets.ModelViewSet):
    """ViewSet for shipment announcements"""
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        if self.request.user.is_staff:
            return ShipmentAnnouncement.objects.all().order_by('-created_at')
        else:
            return ShipmentAnnouncement.objects.filter(
                is_active=True
            ).order_by('-is_featured', '-created_at')

    def create(self, request, *args, **kwargs):
        """Admin creates a new announcement"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()

        # Handle related products
        related_products = request.data.getlist('related_products', [])

        try:
            announcement = ShipmentAnnouncement.objects.create(
                title=data.get('title'),
                description=data.get('description'),
                image=request.FILES.get('image'),
                created_by=request.user,
                is_active=data.get('is_active', True),
                is_featured=data.get('is_featured', False)
            )

            # Add related products
            if related_products:
                valid_products = Product.objects.filter(id__in=related_products)
                announcement.related_products.set(valid_products)

            return Response({
                'message': 'Announcement created successfully',
                'announcement': {
                    'id': announcement.id,
                    'title': announcement.title,
                    'description': announcement.description,
                    'image_url': announcement.get_image_url(),
                    'products_count': announcement.products_count,
                    'created_at': announcement.created_at
                }
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'error': f'Failed to create announcement: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

    def list(self, request, *args, **kwargs):
        """List announcements with related products"""
        announcements = self.get_queryset()

        # Limit to recent announcements for customers
        if not request.user.is_staff:
            announcements = announcements[:20]  # Show last 20 announcements

        announcement_data = []
        for announcement in announcements:
            data = {
                'id': announcement.id,
                'title': announcement.title,
                'description': announcement.description,
                'image': announcement.get_image_url(),
                'is_featured': announcement.is_featured,
                'created_at': announcement.created_at,
                'products_count': announcement.products_count,
                'products': []
            }

            # Add related products info
            if announcement.related_products.exists():
                for product in announcement.related_products.filter(is_active=True)[:5]:  # Limit to 5 products
                    data['products'].append({
                        'id': product.id,
                        'name': product.name,
                        'image_url': product.get_primary_image_url(),
                        'base_price': product.base_price,
                        'stock': product.stock
                    })

            announcement_data.append(data)

        return Response(announcement_data)

    @action(detail=False, methods=['GET'])
    def recent(self, request):
        """Get recent announcements (last 7 days)"""
        week_ago = timezone.now() - timedelta(days=7)
        announcements = self.get_queryset().filter(created_at__gte=week_ago)

        return Response([
            {
                'id': ann.id,
                'title': ann.title,
                'description': ann.description[:200] + '...' if len(ann.description) > 200 else ann.description,
                'image': ann.get_image_url(),
                'created_at': ann.created_at,
                'products_count': ann.products_count
            } for ann in announcements
        ])


class ProductCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for product categories"""
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return ProductCategory.objects.filter(is_active=True).order_by('order', 'name')

    @action(detail=True, methods=['GET'])
    def products(self, request, pk=None):
        """Get products in a specific category"""
        category = self.get_object()
        products = Product.objects.filter(
            category=category,
            is_active=True
        ).order_by('-created_at')

        serializer = ProductSerializer(products, many=True)
        return Response({
            'category': {
                'id': category.id,
                'name': category.name,
                'description': category.description
            },
            'products_count': products.count(),
            'products': serializer.data
        })


