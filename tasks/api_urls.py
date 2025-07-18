from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from tasks.views.customers import CustomerViewSet
from tasks.views.products import ProductViewSet
from tasks.views.orders import OrderViewSet, OrderItemViewSet
from tasks.views.invoices import InvoiceViewSet, PaymentViewSet
from tasks.views.auth import get_csrf_token, customer_register, customer_login, customer_logout

# Create router and register viewsets
router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'order-items', OrderItemViewSet, basename='orderitem')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')

# URL patterns for authentication and API endpoints
urlpatterns = [
    # CSRF and auth endpoints
    path('csrf/', get_csrf_token, name='csrf_token'),
    path('auth/register/', customer_register, name='customer_register'),
    path('auth/login/', customer_login, name='customer_login'),
    path('auth/logout/', customer_logout, name='customer_logout'),

    # JWT token endpoints
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),

    # API endpoints from the router
    path('', include(router.urls)),
]