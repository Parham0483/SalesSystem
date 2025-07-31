from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from tasks.views.customers import CustomerViewSet
from tasks.views.orders import OrderViewSet, OrderItemViewSet,view_payment_receipt
from tasks.views.invoices import InvoiceViewSet
from tasks.views.dealers import DealerViewSet
from tasks.views.auth import get_csrf_token, customer_register, customer_login, customer_logout
from tasks.views.products import ShipmentAnnouncementViewSet, ProductCategoryViewSet, ProductViewSet
from tasks.views.admin import (
    AdminDashboardViewSet, AdminProductViewSet, AdminOrderViewSet,
    AdminCustomerViewSet, AdminDealerViewSet, AdminAnnouncementViewSet,
    AdminReportsViewSet
)
from tasks.views.profile import (
    UserProfileViewSet,
    request_password_reset,
    verify_reset_otp,
    reset_password
)
from tasks.views.google_auth import google_auth, complete_google_profile, link_google_account



# Create router and register viewsets
router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'order-items', OrderItemViewSet, basename='orderitem')
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'dealers', DealerViewSet, basename='dealer')
router.register(r'shipment-announcements', ShipmentAnnouncementViewSet, basename='shipmentannouncement')
router.register(r'categories', ProductCategoryViewSet, basename='categories')

# Admin-specific routes
router.register(r'admin/dashboard', AdminDashboardViewSet, basename='admin-dashboard')
router.register(r'admin/products', AdminProductViewSet, basename='admin-products')
router.register(r'admin/orders', AdminOrderViewSet, basename='admin-orders')
router.register(r'admin/customers', AdminCustomerViewSet, basename='admin-customers')
router.register(r'admin/dealers', AdminDealerViewSet, basename='admin-dealers')
router.register(r'admin/announcements', AdminAnnouncementViewSet, basename='admin-announcements')
router.register(r'admin/reports', AdminReportsViewSet, basename='admin-reports')
router.register(r'profile', UserProfileViewSet, basename='profile')

# URL patterns for authentication and API endpoints
urlpatterns = [
    # CSRF and auth endpoints
    path('csrf/', get_csrf_token, name='csrf_token'),
    path('auth/register/', customer_register, name='customer_register'),
    path('auth/login/', customer_login, name='customer_login'),
    path('auth/logout/', customer_logout, name='customer_logout'),
    path('receipts/<int:receipt_id>/view/', view_payment_receipt, name='view_receipt'),



    # JWT token endpoints
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),

# Google OAuth endpoints
    path('auth/google/', google_auth, name='google_auth'),
    path('auth/google/complete-profile/', complete_google_profile, name='google_complete_profile'),
    path('auth/google/link-account/', link_google_account, name='google_link_account'),

    #Password Reset URLs
    path('auth/password-reset/request/', request_password_reset, name='password_reset_request'),
    path('auth/password-reset/verify-otp/', verify_reset_otp, name='password_reset_verify'),
    path('auth/password-reset/reset/', reset_password, name='password_reset_complete'),

    # API endpoints from the router
    path('', include(router.urls)),
]