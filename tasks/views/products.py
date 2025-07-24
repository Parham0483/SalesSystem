# tasks/views/products.py - Updated to match your models
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone
from django.db.models import Q, Count, Sum
from datetime import timedelta
from ..serializers.products import (
    ProductSerializer, ProductCategorySerializer, ProductImageSerializer,
    ShipmentAnnouncementSerializer, ProductStockUpdateSerializer,
    ProductSearchSerializer, ProductBulkUpdateSerializer
)
from ..models import Product, ShipmentAnnouncement, ProductCategory, ProductImage


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

        # Add admin-specific info
        product_data = []
        for product in products:
            data = ProductSerializer(product).data
            data.update({
                'days_since_created': (timezone.now() - product.created_at).days,
                'orders_count': product.orderitem_set.count(),
                'total_ordered': sum(
                    item.final_quantity for item in product.orderitem_set.all()
                ),
                'revenue_generated': float(sum(
                    item.total_price for item in product.orderitem_set.filter(
                        order__status='completed'
                    )
                ))
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

    @action(detail=False, methods=['GET'], url_path='out-of-stock')
    def out_of_stock(self, request):
        """Get out of stock products (admin only)"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        products = Product.get_out_of_stock_products()
        serializer = self.get_serializer(products, many=True)

        return Response({
            'count': products.count(),
            'products': serializer.data
        })

    @action(detail=False, methods=['GET'])
    def search(self, request):
        """Search products by name, description, or tags"""
        serializer = ProductSearchSerializer(data=request.query_params)

        if not serializer.is_valid():
            return Response({
                'error': 'Invalid search parameters',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        validated_data = serializer.validated_data
        query = validated_data.get('q', '').strip()
        category_id = validated_data.get('category')
        min_price = validated_data.get('min_price')
        max_price = validated_data.get('max_price')
        in_stock_only = validated_data.get('in_stock_only', False)
        sort_by = validated_data.get('sort_by', '-created_at')

        products = self.get_queryset()

        # Apply filters
        if query:
            products = products.filter(
                Q(name__icontains=query) |
                Q(description__icontains=query) |
                Q(tags__icontains=query) |
                Q(sku__icontains=query)
            )

        if category_id:
            products = products.filter(category_id=category_id)

        if min_price is not None:
            products = products.filter(base_price__gte=min_price)

        if max_price is not None:
            products = products.filter(base_price__lte=max_price)

        if in_stock_only:
            products = products.filter(stock__gt=0)

        # Apply sorting
        products = products.order_by(sort_by)

        # Limit results
        products = products[:100]

        serializer = self.get_serializer(products, many=True)
        return Response({
            'query': query,
            'filters': {
                'category_id': category_id,
                'min_price': min_price,
                'max_price': max_price,
                'in_stock_only': in_stock_only,
                'sort_by': sort_by
            },
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
        serializer = ProductStockUpdateSerializer(data=request.data)

        if serializer.is_valid():
            new_stock = serializer.validated_data['stock']
            old_stock = product.stock

            product.stock = new_stock
            product.save()

            return Response({
                'message': 'Stock updated successfully',
                'product_id': product.id,
                'product_name': product.name,
                'old_stock': old_stock,
                'new_stock': new_stock,
                'stock_status': product.stock_status
            })

        return Response({
            'error': 'Invalid data',
            'details': serializer.errors
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
            'product_name': product.name,
            'is_active': product.is_active
        })

    @action(detail=False, methods=['POST'], url_path='bulk-update')
    def bulk_update(self, request):
        """Bulk update products (admin only)"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = ProductBulkUpdateSerializer(data=request.data)

        if serializer.is_valid():
            validated_data = serializer.validated_data
            product_ids = validated_data['product_ids']
            action = validated_data['action']

            products = Product.objects.filter(id__in=product_ids)

            if not products.exists():
                return Response({
                    'error': 'No products found with the provided IDs'
                }, status=status.HTTP_404_NOT_FOUND)

            updated_count = 0

            if action == 'activate':
                updated_count = products.update(is_active=True)
            elif action == 'deactivate':
                updated_count = products.update(is_active=False)
            elif action == 'update_category':
                category_id = validated_data.get('category_id')
                updated_count = products.update(category_id=category_id)
            elif action == 'update_stock':
                new_stock = validated_data.get('new_stock')
                if new_stock is not None:
                    updated_count = products.update(stock=new_stock)
                else:
                    stock_change = validated_data.get('stock_change', 0)
                    for product in products:
                        new_stock = max(0, product.stock + stock_change)
                        product.stock = new_stock
                        product.save()
                        updated_count += 1
            elif action == 'delete':
                updated_count = products.count()
                products.delete()

            return Response({
                'message': f'Bulk {action} completed successfully',
                'updated_count': updated_count,
                'action': action
            })

        return Response({
            'error': 'Invalid data',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

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

    @action(detail=False, methods=['GET'], url_path='analytics')
    def analytics(self, request):
        """Get product analytics (admin only)"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        total_products = Product.objects.count()
        active_products = Product.objects.filter(is_active=True).count()
        out_of_stock_products = Product.objects.filter(stock=0, is_active=True).count()

        # New products this month
        month_ago = timezone.now() - timedelta(days=30)
        new_products_this_month = Product.objects.filter(created_at__gte=month_ago).count()

        # Top selling products (by quantity ordered)
        from django.db.models import Sum
        top_selling = Product.objects.annotate(
            total_ordered=Sum('orderitem__final_quantity')
        ).filter(
            total_ordered__isnull=False
        ).order_by('-total_ordered')[:10]

        top_selling_data = []
        for product in top_selling:
            top_selling_data.append({
                'id': product.id,
                'name': product.name,
                'total_ordered': product.total_ordered or 0,
                'current_stock': product.stock,
                'image_url': product.get_primary_image_url()
            })

        # Categories breakdown
        categories_breakdown = []
        categories = ProductCategory.objects.filter(is_active=True)
        for category in categories:
            categories_breakdown.append({
                'id': category.id,
                'name': category.name,
                'products_count': category.products_count,
                'active_products': category.products.filter(is_active=True).count()
            })

        return Response({
            'total_products': total_products,
            'active_products': active_products,
            'out_of_stock_products': out_of_stock_products,
            'new_products_this_month': new_products_this_month,
            'top_selling_products': top_selling_data,
            'categories_breakdown': categories_breakdown
        })


class ShipmentAnnouncementViewSet(viewsets.ModelViewSet):
    """ViewSet for shipment announcements"""
    authentication_classes = [JWTAuthentication]
    serializer_class = ShipmentAnnouncementSerializer

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

    def perform_create(self, serializer):
        """Set created_by when creating announcement"""
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        """Admin creates a new announcement"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        return super().create(request, *args, **kwargs)

    def list(self, request, *args, **kwargs):
        """List announcements with related products"""
        announcements = self.get_queryset()

        # Limit to recent announcements for customers
        if not request.user.is_staff:
            announcements = announcements[:20]

        serializer = self.get_serializer(announcements, many=True)
        return Response(serializer.data)

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

    @action(detail=False, methods=['GET'])
    def featured(self, request):
        """Get featured announcements"""
        announcements = self.get_queryset().filter(is_featured=True)[:5]
        serializer = self.get_serializer(announcements, many=True)
        return Response(serializer.data)


class ProductCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for product categories"""
    authentication_classes = [JWTAuthentication]
    serializer_class = ProductCategorySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'products']:
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
                'description': category.description,
                'image_url': category.image.url if category.image else None
            },
            'products_count': products.count(),
            'products': serializer.data
        })

    @action(detail=False, methods=['GET'], url_path='with-products')
    def with_products(self, request):
        """Get categories that have products"""
        categories = self.get_queryset().annotate(
            active_products_count=Count('products', filter=Q(products__is_active=True))
        ).filter(active_products_count__gt=0)

        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)


class ProductImageViewSet(viewsets.ModelViewSet):
    """ViewSet for managing product images"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]
    serializer_class = ProductImageSerializer

    def get_queryset(self):
        return ProductImage.objects.all().order_by('order')

    @action(detail=True, methods=['POST'], url_path='set-primary')
    def set_primary(self, request, pk=None):
        """Set this image as primary for the product"""
        image = self.get_object()
        product = image.product

        # Remove primary status from other images
        ProductImage.objects.filter(product=product).update(is_primary=False)

        # Set this image as primary
        image.is_primary = True
        image.save()

        return Response({
            'message': 'Image set as primary successfully',
            'image_id': image.id,
            'product_id': product.id
        })