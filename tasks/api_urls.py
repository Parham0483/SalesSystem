from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from tasks.views.customers import CustomerViewSet
from tasks.views.products import ProductViewSet
from tasks.views.orders import OrderViewSet, OrderItemViewSet
from tasks.views.invoices import InvoiceViewSet, PaymentViewSet
from tasks.views.auth import get_csrf_token, customer_register, customer_login


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
    # CSRF and auth endpoints at the expected paths
    path('csrf/', get_csrf_token, name='csrf_token'),  # /api/csrf/
    path('auth/register/', customer_register, name='customer_register'),  # /api/auth/register/
    path('auth/login/', customer_login, name='customer_login'),           # /api/auth/login/
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # API endpoints from the router
    path('', include(router.urls)),
]

