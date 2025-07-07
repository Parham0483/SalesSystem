# tasks/api_urls.py
from rest_framework.routers import DefaultRouter
from .api_views import (
    CustomerViewSet, ProductViewSet, OrderViewSet,
    OrderItemViewSet, InvoiceViewSet, WalletViewSet, PaymentViewSet
)

router = DefaultRouter()
router.register(r'customers', CustomerViewSet)
router.register(r'products', ProductViewSet)
router.register(r'orders', OrderViewSet)
router.register(r'order-items', OrderItemViewSet)
router.register(r'invoices', InvoiceViewSet)
router.register(r'wallets', WalletViewSet)
router.register(r'payments', PaymentViewSet)

urlpatterns = router.urls
