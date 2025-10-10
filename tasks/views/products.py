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
    ProductSerializer, ProductCategorySerializer, ProductImageSerializer, ProductStockUpdateSerializer,
    ProductSearchSerializer, ProductBulkUpdateSerializer, ShipmentAnnouncementSerializer
)
from ..models import Product, ShipmentAnnouncement, ProductCategory, ProductImage
from rest_framework.pagination import PageNumberPagination, LimitOffsetPagination


class ProductPagination(LimitOffsetPagination):
    default_limit = 9
    max_limit = 50
    limit_query_param = 'limit'
    offset_query_param = 'offset'


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by('-created_at')
    serializer_class = ProductSerializer
    pagination_class = ProductPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search', None)
        category_id = self.request.query_params.get('category_id', None)
        status_filter = self.request.query_params.get('status', None)

        if search:
            queryset = queryset.filter(name__icontains=search)
        if category_id and category_id != 'all':
            queryset = queryset.filter(category_id=category_id)
        if status_filter and status_filter != 'all':
            queryset = queryset.filter(stock_status=status_filter)

        print(f"Queryset size: {queryset.count()}")
        print(f"Queryset IDs: {[p.id for p in queryset[:25]]}")
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        print(f"Query params: {request.query_params}")
        page = self.paginate_queryset(queryset)
        if page is not None:
            print(f"Paginated IDs: {[p.id for p in page]}")
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Admin creates a new product with images upload support"""
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
        """Admin updates product with images upload support"""
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
        """Enhanced search with proper filtering"""
        query = request.query_params.get('q', '').strip()
        category_id = request.query_params.get('category')
        min_price = request.query_params.get('min_price')
        max_price = request.query_params.get('max_price')
        in_stock_only = request.query_params.get('in_stock_only', '').lower() == 'true'
        sort_by = request.query_params.get('sort_by', '-created_at')

        queryset = self.get_queryset()

        # Apply filters
        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) |
                Q(description__icontains=query) |
                Q(tags__icontains=query) |
                Q(sku__icontains=query)
            )

        if category_id:
            try:
                queryset = queryset.filter(category_id=int(category_id))
            except (ValueError, TypeError):
                pass

        if min_price is not None:
            try:
                queryset = queryset.filter(base_price__gte=float(min_price))
            except (ValueError, TypeError):
                pass

        if max_price is not None:
            try:
                queryset = queryset.filter(base_price__lte=float(max_price))
            except (ValueError, TypeError):
                pass

        if in_stock_only:
            queryset = queryset.filter(stock__gt=0)

        # Apply sorting
        if sort_by in ['name', '-name', 'created_at', '-created_at', 'base_price', '-base_price', 'stock', '-stock']:
            queryset = queryset.order_by(sort_by)

        # Limit results
        queryset = queryset[:100]

        serializer = self.get_serializer(queryset, many=True)
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
        """Get all product categories with proper structure"""
        try:
            categories = ProductCategory.objects.filter(is_active=True).order_by('order', 'name')

            category_data = []
            for category in categories:
                category_data.append({
                    'id': category.id,
                    'name': category.name,
                    'name_fa': getattr(category, 'name_fa', category.name),
                    'display_name': getattr(category, 'display_name', category.name),
                    'description': getattr(category, 'description', ''),
                    'image_url': category.image.url if hasattr(category, 'image') and category.image else None,
                    'products_count': getattr(category, 'products_count', 0),
                    'parent_id': getattr(category, 'parent_id', None),
                    'slug': getattr(category, 'slug', ''),
                    'subcategories': []
                })

            return Response(category_data)
        except Exception as e:
            print(f"Error fetching categories: {str(e)}")
            return Response([])


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

    @action(detail=True, methods=['POST'], url_path='update-tax-rate')
    def update_tax_rate(self, request, pk=None):
        """Update product tax rate (admin only)"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        product = self.get_object()
        new_tax_rate = request.data.get('tax_rate')

        if new_tax_rate is None:
            return Response({
                'error': 'Tax rate is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_tax_rate = float(new_tax_rate)
            if new_tax_rate < 0 or new_tax_rate > 100:
                return Response({
                    'error': 'Tax rate must be between 0 and 100'
                }, status=status.HTTP_400_BAD_REQUEST)

            old_tax_rate = product.tax_rate
            product.tax_rate = new_tax_rate
            product.save()

            return Response({
                'message': 'Tax rate updated successfully',
                'product_id': product.id,
                'product_name': product.name,
                'old_tax_rate': float(old_tax_rate),
                'new_tax_rate': new_tax_rate
            })

        except ValueError:
            return Response({
                'error': 'Invalid tax rate value'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='thumbnails-only')
    def thumbnails_only(self, request):
        """Endpoint to get just thumbnail data for initial load"""
        products = self.get_queryset()

        # Apply filters
        search = request.query_params.get('search', '')
        category = request.query_params.get('category', '')
        status = request.query_params.get('status', '')

        if search:
            products = products.filter(
                Q(name__icontains=search) |
                Q(description__icontains=search)
            )

        if category and category != 'all':
            products = products.filter(category_id=category)

        if status and status != 'all':
            if status == 'in_stock':
                products = products.filter(stock__gt=0)
            elif status == 'out_of_stock':
                products = products.filter(stock=0)

        # Paginate
        page = self.paginate_queryset(products)
        if page is not None:
            thumbnail_data = []
            for product in page:
                thumbnail_data.append({
                    'id': product.id,
                    'name': product.name,
                    'primary_image_url': self.get_serializer(product).get_primary_image_url(product),
                    'thumbnail_url': self.get_serializer(product).get_thumbnail_url(product),
                    'stock_status': product.stock_status,
                    'created_at': product.created_at,
                    'category_name': product.category_name
                })
            return self.get_paginated_response(thumbnail_data)

        return Response([])

    # Add this to your ProductViewSet in tasks/views/products.py

    @action(detail=True, methods=['GET'], url_path='debug-images')
    def debug_images(self, request, pk=None):
        """Debug endpoint to see what image URLs are being generated"""
        product = self.get_object()

        debug_data = {
            'product_id': product.id,
            'product_name': product.name,
            'product_images_in_db': [],
            'serializer_urls': {}
        }

        # Check what's in the database
        for img in product.images.all():
            debug_data['product_images_in_db'].append({
                'id': img.id,
                'order': img.order,
                'is_primary': img.is_primary,
                'original_image_field': str(img.image) if img.image else None,
                'compressed_image_field': str(img.compressed_image) if img.compressed_image else None,
                'thumbnail_field': str(img.thumbnail) if img.thumbnail else None,
                'original_image_url': img.image.url if img.image else None,
                'compressed_image_url': img.compressed_image.url if img.compressed_image else None,
                'thumbnail_url': img.thumbnail.url if img.thumbnail else None,
                'get_display_url()': img.get_display_url(),
                'get_thumbnail_url()': img.get_thumbnail_url(),
            })

        # Check what the serializer returns
        serializer = ProductSerializer(product, context={'request': request})
        debug_data['serializer_urls'] = {
            'primary_image_url': serializer.get_primary_image_url(product),
            'thumbnail_url': serializer.get_thumbnail_url(product),
            'images': serializer.get_images(product),
            'product_images': serializer.get_product_images(product),
        }

        return Response(debug_data)

    @action(detail=True, methods=['GET'], url_path='debug')
    def debug_product(self, request, pk=None):
        """Debug endpoint to check product structure"""
        product = self.get_object()

        debug_info = {
            'product_id': product.id,
            'product_name': product.name,
            'category': {
                'id': product.category.id if product.category else None,
                'name': product.category.name if product.category else None,
                'name_fa': getattr(product.category, 'name_fa', None) if product.category else None,
            },
            'origin_country': getattr(product, 'origin_country', None),
            'tax_rate': getattr(product, 'tax_rate', None),
            'weight': getattr(product, 'weight', None),
            'base_price': getattr(product, 'base_price', None),
            'stock': getattr(product, 'stock', None),
            'sku': getattr(product, 'sku', None),
        }

        return Response(debug_info)

    # Test this in your Django backend - add this to your ProductViewSet

    @action(detail=False, methods=['GET'], url_path='test-pagination')
    def test_pagination(self, request):
        """Test pagination parameters"""
        limit = request.query_params.get('limit', 20)
        offset = request.query_params.get('offset', 0)

        try:
            limit = int(limit)
            offset = int(offset)
        except ValueError:
            return Response({
                'error': 'Invalid limit or offset',
                'limit': limit,
                'offset': offset
            })

        queryset = self.get_queryset()
        total_count = queryset.count()

        # Manual pagination
        products = queryset[offset:offset + limit]

        return Response({
            'debug_info': {
                'received_limit': limit,
                'received_offset': offset,
                'total_products': total_count,
                'returned_products': len(products),
                'products_range': f"{offset + 1} to {offset + len(products)}",
                'query_params': dict(request.query_params)
            },
            'results': [{'id': p.id, 'name': p.name} for p in products],
            'count': total_count
        })

    @action(detail=False, methods=['GET'], url_path='all-for-orders')
    def all_for_orders(self, request):
        """Get all active products for order creation with stock info"""
        products = Product.objects.filter(is_active=True).select_related('category')

        product_data = []
        for product in products:
            product_data.append({
                'id': product.id,
                'name': product.name,
                'category_id': product.category_id,
                'stock': product.stock,
                'stock_status': product.stock_status,
            })

        return Response(product_data)


class ShipmentAnnouncementViewSet(viewsets.ModelViewSet):
    """Fixed ViewSet for shipment announcements"""
    authentication_classes = [JWTAuthentication]
    serializer_class = ShipmentAnnouncementSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'recent', 'featured']:
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """FIXED: Use correct prefetch_related"""
        if self.request.user.is_staff:
            return ShipmentAnnouncement.objects.select_related('created_by').prefetch_related('additional_images').order_by('-created_at')
        else:
            return ShipmentAnnouncement.objects.filter(
                is_active=True
            ).select_related('created_by').prefetch_related('additional_images').order_by('-is_featured', '-created_at')

    # Add this to your ProductViewSet for debugging
    @action(detail=True, methods=['GET'], url_path='debug')
    def debug_product(self, request, pk=None):
        """Debug endpoint to check product image structure"""
        product = self.get_object()

        # Get all images for this product
        product_images = product.images.all().order_by('order', 'id')

        debug_info = {
            'product_id': product.id,
            'product_name': product.name,
            'total_images_in_db': product_images.count(),
            'images_data': []
        }

        for img in product_images:
            # Set request context
            if request:
                img._request = request

            image_info = {
                'id': img.id,
                'order': img.order,
                'is_primary': img.is_primary,
                'alt_text': img.alt_text,
                'original_image': img.image.url if img.image else None,
                'compressed_image': img.compressed_image.url if img.compressed_image else None,
                'thumbnail': img.thumbnail.url if img.thumbnail else None,
                'get_display_url': img.get_display_url(),
                'get_thumbnail_url': img.get_thumbnail_url(),
            }
            debug_info['images_data'].append(image_info)

        # Also test the serializer output
        serializer = ProductSerializer(product, context={'request': request})
        debug_info['serializer_output'] = {
            'primary_image_url': serializer.get_primary_image_url(product),
            'thumbnail_url': serializer.get_thumbnail_url(product),
            'images': serializer.get_images(product),
            'product_images': serializer.get_product_images(product),
        }

        return Response(debug_info)

    def create(self, request, *args, **kwargs):
        """Create announcement without using DRF serializer for files"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

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

                # FIXED: Handle additional images using correct model
                from ..models import ShipmentAnnouncementImage
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
        """Update announcement without using DRF serializer for files"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

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

                # FIXED: Add additional images using correct model
                from ..models import ShipmentAnnouncementImage
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
        """List announcements"""
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
        limit = int(request.query_params.get('limit', 20))
        announcements = self.get_queryset().filter(created_at__gte=week_ago)[:limit]

        serializer = self.get_serializer(announcements, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['GET'])
    def featured(self, request):
        """Get featured announcements"""
        announcements = self.get_queryset().filter(is_featured=True)[:5]
        serializer = self.get_serializer(announcements, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['POST'], url_path='bulk-action')
    def bulk_action(self, request):
        """Perform bulk actions on announcements"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

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


class ProductCategoryViewSet(viewsets.ModelViewSet):
    """ViewSet for product categories"""
    authentication_classes = [JWTAuthentication]
    serializer_class = ProductCategorySerializer

    def get_permissions(self):
        # READ operations available to all authenticated users
        if self.action in ['list', 'retrieve', 'products', 'with_products']:
            permission_classes = [IsAuthenticated]
        else:
            # CREATE/UPDATE/DELETE only for admins
            permission_classes = [IsAdminUser]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        return ProductCategory.objects.filter(is_active=True).order_by('order', 'name')

    def list(self, request):
        """List all categories with Persian names for everyone"""
        categories = self.get_queryset()

        # Enhanced response with Persian names
        category_data = []
        for category in categories:
            category_data.append({
                'id': category.id,
                'name': category.name,
                'name_fa': category.name_fa,
                'display_name': category.display_name,
                'description': category.description,
                'slug': category.slug,
                'image_url': category.image.url if category.image else None,
                'products_count': category.products_count,
                'order': category.order,
                'parent_id': category.parent_id,
                'created_at': category.created_at,
                'subcategories': [
                    {
                        'id': sub.id,
                        'name': sub.name,
                        'name_fa': sub.name_fa,
                        'display_name': sub.display_name,
                        'products_count': sub.products_count
                    } for sub in category.subcategories.filter(is_active=True)
                ]
            })

        return Response(category_data)

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
                'name_fa': category.name_fa,  # Persian name
                'display_name': category.display_name,
                'description': category.description,
                'image_url': category.image.url if category.image else None,
                'slug': category.slug
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

        category_data = []
        for category in categories:
            category_data.append({
                'id': category.id,
                'name': category.name,
                'name_fa': category.name_fa,
                'display_name': category.display_name,
                'description': category.description,
                'products_count': category.active_products_count,
                'image_url': category.image.url if category.image else None
            })

        return Response(category_data)


class ProductImageViewSet(viewsets.ModelViewSet):
    """ViewSet for managing product images"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdminUser]
    serializer_class = ProductImageSerializer

    def get_queryset(self):
        return ProductImage.objects.all().order_by('order')

    @action(detail=True, methods=['POST'], url_path='set-primary')
    def set_primary(self, request, pk=None):
        """Set this images as primary for the product"""
        image = self.get_object()
        product = image.product

        # Remove primary status from other images
        ProductImage.objects.filter(product=product).update(is_primary=False)

        # Set this images as primary
        image.is_primary = True
        image.save()

        return Response({
            'message': 'Image set as primary successfully',
            'image_id': image.id,
            'product_id': product.id
        })