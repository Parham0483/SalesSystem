# tasks/admin.py - Updated version with new models and features
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.http import HttpResponse
from .models import (
    Customer, Product, Order, OrderItem, Invoice,
    InvoiceTemplate, InvoiceTemplateField, InvoiceSection,
    EmailNotification
)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'company_name', 'is_staff', 'total_orders', 'date_joined']
    list_filter = ['is_staff', 'date_joined', 'is_active']
    search_fields = ['name', 'email', 'company_name']
    readonly_fields = ['date_joined', 'last_login']

    def total_orders(self, obj):
        """Display total orders count for customer"""
        count = obj.order_set.count()
        if count > 0:
            url = reverse('admin:tasks_order_changelist') + f'?customer__id__exact={obj.id}'
            return format_html('<a href="{}">{} orders</a>', url, count)
        return '0 orders'

    total_orders.short_description = 'Total Orders'


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'base_price', 'stock', 'is_active', 'times_ordered', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at']

    def times_ordered(self, obj):
        """Display how many times this product was ordered"""
        count = obj.orderitem_set.count()
        return f"{count} times"

    times_ordered.short_description = 'Ordered'


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ['product', 'requested_quantity', 'quoted_unit_price', 'final_quantity', 'customer_notes', 'admin_notes',
              'total_price']
    readonly_fields = ['customer_notes', 'total_price']  # Admin shouldn't edit customer notes

    def total_price(self, obj):
        """Display calculated total price"""
        if obj.quoted_unit_price and obj.final_quantity:
            total = obj.quoted_unit_price * obj.final_quantity
            return f"{total:,.0f} ریال"
        return "Not calculated"

    total_price.short_description = 'Total Price'


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'customer', 'status_colored', 'quoted_total_display',
        'items_count', 'created_at', 'pricing_date', 'completion_date'
    ]
    list_filter = ['status', 'created_at', 'pricing_date', 'completion_date']
    search_fields = ['customer__name', 'customer__email', 'id']
    readonly_fields = [
        'created_at', 'updated_at', 'customer_response_date',
        'pricing_date', 'completion_date', 'quoted_total_calculated'
    ]
    inlines = [OrderItemInline]
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Order Information', {
            'fields': ['customer', 'status', 'created_at', 'updated_at']
        }),
        ('Customer Request', {
            'fields': ['customer_comment']
        }),
        ('Admin Pricing', {
            'fields': ['admin_comment', 'quoted_total', 'quoted_total_calculated', 'pricing_date', 'priced_by']
        }),
        ('Customer Response', {
            'fields': ['customer_response_date', 'customer_rejection_reason']
        }),
        ('Completion', {
            'fields': ['completion_date', 'completed_by'],
            'classes': ['collapse']
        }),
    )

    actions = ['mark_as_priced', 'mark_as_confirmed', 'mark_as_completed', 'send_pricing_notification']

    def status_colored(self, obj):
        """Display status with color coding"""
        colors = {
            'pending_pricing': '#fbbf24',  # yellow
            'waiting_customer_approval': '#60a5fa',  # blue
            'confirmed': '#34d399',  # green
            'completed': '#10b981',  # dark green
            'rejected': '#f87171',  # red
            'cancelled': '#9ca3af',  # gray
        }
        color = colors.get(obj.status, '#9ca3af')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_status_display()
        )

    status_colored.short_description = 'Status'

    def quoted_total_display(self, obj):
        """Display quoted total with formatting"""
        if obj.quoted_total and obj.quoted_total > 0:
            return f"{obj.quoted_total:,.0f} ریال"
        return "Not quoted"

    quoted_total_display.short_description = 'Quoted Total'

    def quoted_total_calculated(self, obj):
        """Display calculated total from items"""
        total = obj.calculate_total_from_items()
        if total > 0:
            return f"{total:,.0f} ریال"
        return "No items priced"

    quoted_total_calculated.short_description = 'Calculated Total'

    def items_count(self, obj):
        """Display items count"""
        count = obj.items.count()
        return f"{count} items"

    items_count.short_description = 'Items'

    def mark_as_priced(self, request, queryset):
        """Admin action to mark orders as priced"""
        count = 0
        for order in queryset.filter(status='pending_pricing'):
            try:
                order.mark_as_priced_by_admin()
                count += 1
            except Exception as e:
                self.message_user(request, f"Error pricing order {order.id}: {e}", level='ERROR')

        if count > 0:
            self.message_user(request, f"{count} orders marked as priced")

    mark_as_priced.short_description = "Mark selected orders as priced"

    def mark_as_confirmed(self, request, queryset):
        """Admin action to confirm orders"""
        count = 0
        for order in queryset.filter(status='waiting_customer_approval'):
            try:
                order.customer_approve()
                count += 1
            except Exception as e:
                self.message_user(request, f"Error confirming order {order.id}: {e}", level='ERROR')

        if count > 0:
            self.message_user(request, f"{count} orders confirmed")

    mark_as_confirmed.short_description = "Confirm selected orders"

    def mark_as_completed(self, request, queryset):
        """Admin action to complete orders"""
        count = 0
        for order in queryset.filter(status='confirmed'):
            try:
                order.mark_as_completed(request.user)
                count += 1
            except Exception as e:
                self.message_user(request, f"Error completing order {order.id}: {e}", level='ERROR')

        if count > 0:
            self.message_user(request, f"{count} orders completed")

    mark_as_completed.short_description = "Mark selected orders as completed"

    def send_pricing_notification(self, request, queryset):
        """Send pricing notification to customers"""
        from .services.notification_service import NotificationService

        count = 0
        for order in queryset.filter(status='waiting_customer_approval'):
            try:
                if NotificationService.notify_customer_pricing_ready(order):
                    count += 1
            except Exception as e:
                self.message_user(request, f"Error sending notification for order {order.id}: {e}", level='ERROR')

        if count > 0:
            self.message_user(request, f"Pricing notifications sent for {count} orders")

    send_pricing_notification.short_description = "Send pricing notifications"


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ['order_link', 'product', 'requested_quantity', 'quoted_unit_price', 'final_quantity',
                    'total_price_display', 'is_priced']
    list_filter = ['order__status', 'product']
    search_fields = ['product__name', 'order__customer__name', 'order__id']
    readonly_fields = ['total_price_display']

    def order_link(self, obj):
        """Link to order admin page"""
        url = reverse('admin:tasks_order_change', args=[obj.order.id])
        return format_html('<a href="{}">Order #{}</a>', url, obj.order.id)

    order_link.short_description = 'Order'

    def total_price_display(self, obj):
        """Display total price with formatting"""
        if obj.quoted_unit_price and obj.final_quantity:
            total = obj.quoted_unit_price * obj.final_quantity
            return f"{total:,.0f} ریال"
        return "Not calculated"

    total_price_display.short_description = 'Total Price'

    def is_priced(self, obj):
        """Show if item is priced"""
        if obj.quoted_unit_price and obj.quoted_unit_price > 0:
            return "✅ Yes"
        return "❌ No"

    is_priced.short_description = 'Priced'


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = [
        'invoice_number', 'order_link', 'invoice_type', 'total_amount_display',
        'payable_amount_display', 'is_finalized', 'is_paid', 'has_pdf', 'issued_at'
    ]
    list_filter = ['invoice_type', 'is_finalized', 'is_paid', 'issued_at']
    search_fields = ['invoice_number', 'order__customer__name', 'order__id']
    readonly_fields = ['issued_at', 'tax_amount', 'payable_amount']
    actions = ['generate_pdfs', 'finalize_invoices']

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

    def order_link(self, obj):
        """Link to order admin page"""
        url = reverse('admin:tasks_order_change', args=[obj.order.id])
        return format_html('<a href="{}">Order #{}</a>', url, obj.order.id)

    order_link.short_description = 'Order'

    def total_amount_display(self, obj):
        """Display total amount with formatting"""
        return f"{obj.total_amount:,.0f} ریال"

    total_amount_display.short_description = 'Total Amount'

    def payable_amount_display(self, obj):
        """Display payable amount with formatting"""
        return f"{obj.payable_amount:,.0f} ریال"

    payable_amount_display.short_description = 'Payable Amount'

    def has_pdf(self, obj):
        """Show if PDF exists"""
        if obj.pdf_file:
            return format_html('<a href="{}" target="_blank">📄 View PDF</a>', obj.pdf_file.url)
        return "❌ No PDF"

    has_pdf.short_description = 'PDF'

    def generate_pdfs(self, request, queryset):
        """Generate PDFs for selected invoices"""
        count = 0
        for invoice in queryset:
            try:
                invoice.generate_pdf()
                count += 1
            except Exception as e:
                self.message_user(request, f"Error generating PDF for invoice {invoice.invoice_number}: {e}",
                                  level='ERROR')

        if count > 0:
            self.message_user(request, f"PDFs generated for {count} invoices")

    generate_pdfs.short_description = "Generate PDFs"

    def finalize_invoices(self, request, queryset):
        """Finalize selected invoices"""
        count = 0
        for invoice in queryset.filter(is_finalized=False):
            try:
                invoice.finalize_invoice()
                count += 1
            except Exception as e:
                self.message_user(request, f"Error finalizing invoice {invoice.invoice_number}: {e}", level='ERROR')

        if count > 0:
            self.message_user(request, f"{count} invoices finalized")

    finalize_invoices.short_description = "Finalize invoices"


# NEW: Template System Admin
@admin.register(InvoiceTemplate)
class InvoiceTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'language', 'is_active', 'fields_count', 'sections_count', 'created_at']
    list_filter = ['language', 'is_active', 'created_at']
    search_fields = ['name']
    readonly_fields = ['created_at']

    def fields_count(self, obj):
        """Display number of fields"""
        return obj.fields.count()

    fields_count.short_description = 'Fields'

    def sections_count(self, obj):
        """Display number of sections"""
        return obj.sections.count()

    sections_count.short_description = 'Sections'


class InvoiceTemplateFieldInline(admin.TabularInline):
    model = InvoiceTemplateField
    extra = 0
    fields = ['field_key', 'field_label', 'field_type', 'section', 'display_order', 'is_required']
    ordering = ['section', 'display_order']


class InvoiceSectionInline(admin.TabularInline):
    model = InvoiceSection
    extra = 0
    fields = ['section_key', 'section_title', 'display_order', 'is_table']
    ordering = ['display_order']


# Add inlines to template admin
InvoiceTemplateAdmin.inlines = [InvoiceSectionInline, InvoiceTemplateFieldInline]


@admin.register(InvoiceTemplateField)
class InvoiceTemplateFieldAdmin(admin.ModelAdmin):
    list_display = ['template', 'field_label', 'field_key', 'field_type', 'section', 'display_order', 'is_required']
    list_filter = ['template', 'field_type', 'section', 'is_required']
    search_fields = ['field_label', 'field_key']
    ordering = ['template', 'section', 'display_order']


@admin.register(InvoiceSection)
class InvoiceSectionAdmin(admin.ModelAdmin):
    list_display = ['template', 'section_title', 'section_key', 'display_order', 'is_table']
    list_filter = ['template', 'is_table']
    search_fields = ['section_title', 'section_key']
    ordering = ['template', 'display_order']


# NEW: Email Notification Admin
@admin.register(EmailNotification)
class EmailNotificationAdmin(admin.ModelAdmin):
    list_display = ['order_link', 'email_type_colored', 'recipient_email', 'subject_truncated', 'is_successful',
                    'sent_at']
    list_filter = ['email_type', 'is_successful', 'sent_at']
    search_fields = ['recipient_email', 'subject', 'order__id', 'order__customer__name']
    readonly_fields = ['sent_at']
    date_hierarchy = 'sent_at'

    def order_link(self, obj):
        """Link to order admin page"""
        url = reverse('admin:tasks_order_change', args=[obj.order.id])
        return format_html('<a href="{}">Order #{}</a>', url, obj.order.id)

    order_link.short_description = 'Order'

    def email_type_colored(self, obj):
        """Display email type with color coding"""
        colors = {
            'order_submitted': '#60a5fa',  # blue
            'pricing_ready': '#fbbf24',  # yellow
            'order_confirmed': '#34d399',  # green
            'order_rejected': '#f87171',  # red
            'order_completed': '#10b981',  # dark green
        }
        color = colors.get(obj.email_type, '#9ca3af')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_email_type_display()
        )

    email_type_colored.short_description = 'Email Type'

    def subject_truncated(self, obj):
        """Display truncated subject"""
        if len(obj.subject) > 50:
            return f"{obj.subject[:50]}..."
        return obj.subject

    subject_truncated.short_description = 'Subject'


# Customize admin site
admin.site.site_header = "Order Management System"
admin.site.site_title = "OMS Admin"
admin.site.index_title = "Welcome to Order Management System"