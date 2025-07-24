from .customers import CustomerSerializer
from .products import (
    ProductSerializer, ProductCategorySerializer, ProductImageSerializer,
    ShipmentAnnouncementSerializer, ProductStockUpdateSerializer,
    ProductSearchSerializer, ProductBulkUpdateSerializer
)
from .invoices import InvoiceSerializer
from .orders import (OrderItemSerializer, OrderCreateSerializer,
                     OrderItemAdminUpdateSerializer,OrderAdminUpdateSerializer,
                     OrderDetailSerializer)
from .dealers import (
    DealerSerializer, DealerAssignmentSerializer,
    DealerNotesUpdateSerializer, DealerCommissionSerializer
)