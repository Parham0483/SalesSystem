# urls.py (in your app)
from django.urls import path
from . import views

urlpatterns = [
    # API Endpoints
    path('api/products/<int:product_id>/', views.get_product_info, name='get_product_info'),
]

