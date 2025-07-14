from django.urls import path
from . import api_views

urlpatterns = [
    path('csrf/', api_views.get_csrf_token, name='csrf_token'),
    path('login/', api_views.customer_login, name='customer_login'),
]