from django.contrib import admin
from .models import Customer, Product, Order, OrderItem, Invoice, Wallet, Payment


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'company_name', 'is_staff', 'date_joined']
    list_filter = ['is_staff', 'date_joined']
    search_fields = ['name', 'email', 'company_name']
    readonly_fields = ['date_joined']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'base_price', 'stock', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at']


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

    fields = ['product', 'requested_quantity', 'quoted_unit_price', 'final_quantity', 'customer_notes', 'admin_notes']
    readonly_fields = ['customer_notes']  # Admin shouldn't edit customer notes


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'status', 'quoted_total', 'created_at', 'pricing_date']  # Fixed: use quoted_total instead of total_amount
    list_filter = ['status', 'created_at', 'pricing_date']
    search_fields = ['customer__name', 'customer__email']
    readonly_fields = ['created_at', 'updated_at', 'customer_response_date']
    inlines = [OrderItemInline]
    
    fieldsets = (
        ('Order Information', {
            'fields': ['customer', 'status', 'created_at', 'updated_at']
        }),
        ('Customer Request', {
            'fields': ['customer_comment']
        }),
        ('Admin Pricing', {
            'fields': ['admin_comment', 'quoted_total', 'pricing_date']
        }),
        ('Customer Response', {
            'fields': ['customer_response_date', 'customer_rejection_reason']
        }),
    )
    
    actions = ['mark_as_priced', 'mark_as_confirmed']
    
    def mark_as_priced(self, request, queryset):
        """Admin action to mark orders as priced"""
        for order in queryset:
            order.mark_as_priced_by_admin()
        self.message_user(request, f"{queryset.count()} orders marked as priced")
    mark_as_priced.short_description = "Mark selected orders as priced"
    
    def mark_as_confirmed(self, request, queryset):
        """Admin action to confirm orders"""
        for order in queryset:
            order.customer_approve()
        self.message_user(request, f"{queryset.count()} orders confirmed")
    mark_as_confirmed.short_description = "Confirm selected orders"


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order', 'product', 'requested_quantity', 'quoted_unit_price', 'final_quantity', 'total_price']
    list_filter = ['order__status']
    search_fields = ['product__name', 'order__customer__name']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'order', 'invoice_type', 'total_amount', 'payable_amount', 'is_finalized', 'is_paid']
    list_filter = ['invoice_type', 'is_finalized', 'is_paid', 'issued_at']
    search_fields = ['invoice_number', 'order__customer__name']
    readonly_fields = ['issued_at', 'tax_amount', 'payable_amount']
    
    fieldsets = (
        ('Invoice Information', {
            'fields': ['invoice_number', 'order', 'invoice_type', 'issued_at']
        }),
        ('Financial Details', {
            'fields': ['total_amount', 'discount', 'tax_rate', 'tax_amount', 'payable_amount']
        }),
        ('Status', {
            'fields': ['is_finalized', 'is_paid', 'due_date']
        }),
        ('Files', {
            'fields': ['pdf_file']
        }),
    )


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ['customer', 'balance', 'last_updated']
    search_fields = ['customer__name', 'customer__email']
    readonly_fields = ['last_updated']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['transaction_id', 'invoice', 'amount', 'payment_method', 'is_successful', 'payment_date']
    list_filter = ['payment_method', 'is_successful', 'payment_date']
    search_fields = ['transaction_id', 'invoice__invoice_number', 'reference_number']
    readonly_fields = ['payment_date', 'transaction_id']
    
    fieldsets = (
        ('Payment Information', {
            'fields': ['invoice', 'amount', 'payment_method', 'payment_date']
        }),
        ('Transaction Details', {
            'fields': ['transaction_id', 'reference_number', 'is_successful']
        }),
        ('Additional Information', {
            'fields': ['notes', 'processed_by']
        }),
    )