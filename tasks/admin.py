# tasks/admin.py - Enhanced version with dealer management
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.http import HttpResponse
from django.db.models import Sum
from decimal import Decimal

from . import models
from .models import (
    Customer, Product, Order, OrderItem, Invoice,
    InvoiceTemplate, InvoiceTemplateField, InvoiceSection,
    EmailNotification, OrderLog, DealerCommission, SMSNotification
)
from .services.sms_service import KavenegarSMSService



class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    fields = ['product', 'requested_quantity', 'quoted_unit_price', 'final_quantity', 'customer_notes', 'admin_notes',
              'total_price']
    readonly_fields = ['customer_notes', 'total_price']

    def total_price(self, obj):
        """Display calculated total price"""
        if obj.quoted_unit_price and obj.final_quantity:
            total = obj.quoted_unit_price * obj.final_quantity
            return f"${total:,.2f}"
        return "Not calculated"

    total_price.short_description = 'Total Price'


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'customer', 'status_colored', 'dealer_info', 'quoted_total_display',
        'items_count', 'created_at', 'pricing_date', 'completion_date'
    ]
    list_filter = ['status', 'created_at', 'pricing_date', 'completion_date', 'assigned_dealer']
    search_fields = ['customer__name', 'customer__email', 'id', 'assigned_dealer__name']
    readonly_fields = [
        'created_at', 'updated_at', 'customer_response_date',
        'pricing_date', 'completion_date', 'quoted_total_calculated',
        'dealer_commission_amount'
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
        ('Dealer Assignment', {
            'fields': ['assigned_dealer', 'dealer_assigned_at', 'dealer_notes', 'dealer_commission_amount'],
            'classes': ['collapse']
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

    actions = ['assign_to_dealer', 'remove_dealers', 'mark_as_completed', 'generate_commission_report']

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

    def dealer_info(self, obj):
        """Display dealer assignment information"""
        if obj.assigned_dealer:
            commission = obj.dealer_commission_amount
            return format_html(
                '<strong>{}</strong><br>Code: {}<br>Commission: ${:,.2f}',
                obj.assigned_dealer.name,
                obj.assigned_dealer.dealer_code or 'N/A',
                float(commission)
            )
        return format_html('<span style="color: gray;">No dealer assigned</span>')

    dealer_info.short_description = 'Assigned Dealer'

    def quoted_total_display(self, obj):
        """Display quoted total with formatting"""
        if obj.quoted_total and obj.quoted_total > 0:
            return f"${obj.quoted_total:,.2f}"
        return "Not quoted"

    quoted_total_display.short_description = 'Quoted Total'

    def quoted_total_calculated(self, obj):
        """Display calculated total from items"""
        total = obj.calculate_total_from_items()
        if total > 0:
            return f"${total:,.2f}"
        return "No items priced"

    quoted_total_calculated.short_description = 'Calculated Total'

    def items_count(self, obj):
        """Display items count"""
        count = obj.items.count()
        return f"{count} items"

    items_count.short_description = 'Items'

    # ADMIN ACTIONS
    def assign_to_dealer(self, request, queryset):
        """Assign selected orders to a dealer - simplified version"""
        # This would need a custom intermediate page in a full implementation
        # For now, we'll just show a message
        count = queryset.filter(assigned_dealer__isnull=True).count()
        self.message_user(
            request,
            f"{count} orders available for dealer assignment. Use the order detail page to assign dealers."
        )

    assign_to_dealer.short_description = "Assign to dealer (use detail page)"

    def remove_dealers(self, request, queryset):
        """Remove dealers from selected orders"""
        count = 0
        for order in queryset.filter(assigned_dealer__isnull=False):
            order.remove_dealer(request.user)
            count += 1

        if count > 0:
            self.message_user(request, f"Dealers removed from {count} orders")

    remove_dealers.short_description = "Remove dealers from orders"

    def mark_as_completed(self, request, queryset):
        """Mark confirmed orders as completed"""
        count = 0
        for order in queryset.filter(status='confirmed'):
            try:
                order.mark_as_completed(request.user)

                # Create commission record if dealer assigned
                if order.assigned_dealer:
                    from .models import DealerCommission
                    DealerCommission.create_for_completed_order(order)

                count += 1
            except Exception as e:
                self.message_user(request, f"Error completing order {order.id}: {e}", level='ERROR')

        if count > 0:
            self.message_user(request, f"{count} orders marked as completed")

    mark_as_completed.short_description = "Mark as completed"

    def generate_commission_report(self, request, queryset):
        """Generate commission report for orders with dealers"""
        orders_with_dealers = queryset.filter(
            assigned_dealer__isnull=False,
            status='completed'
        )

        total_commissions = sum(order.dealer_commission_amount for order in orders_with_dealers)

        self.message_user(
            request,
            f"Commission report: {orders_with_dealers.count()} completed orders with dealers. "
            f"Total commissions: ${total_commissions:,.2f}"
        )

    generate_commission_report.short_description = "Generate commission report"


# NEW: Dealer Commission Admin
@admin.register(DealerCommission)
class DealerCommissionAdmin(admin.ModelAdmin):
    list_display = [
        'commission_id', 'dealer_name', 'order_link', 'commission_rate',
        'commission_amount_display', 'order_total_display', 'payment_status', 'created_at'
    ]
    list_filter = ['is_paid', 'created_at', 'commission_rate']
    search_fields = ['dealer__name', 'dealer__email', 'order__id', 'payment_reference']
    readonly_fields = ['created_at', 'commission_amount', 'order_total']

    fieldsets = (
        ('Commission Information', {
            'fields': ['dealer', 'order', 'commission_rate', 'commission_amount', 'order_total', 'created_at']
        }),
        ('Payment Information', {
            'fields': ['is_paid', 'paid_at', 'payment_reference']
        }),
    )

    actions = ['mark_as_paid', 'mark_as_unpaid', 'export_commission_report']

    def commission_id(self, obj):
        return f"COM-{obj.id:06d}"

    commission_id.short_description = 'Commission ID'

    def dealer_name(self, obj):
        return obj.dealer.name

    dealer_name.short_description = 'Dealer'

    def order_link(self, obj):
        url = reverse('admin:tasks_order_change', args=[obj.order.id])
        return format_html('<a href="{}">Order #{}</a>', url, obj.order.id)

    order_link.short_description = 'Order'

    def commission_amount_display(self, obj):
        return f"${obj.commission_amount:,.2f}"

    commission_amount_display.short_description = 'Commission Amount'

    def order_total_display(self, obj):
        return f"${obj.order_total:,.2f}"

    order_total_display.short_description = 'Order Total'

    def payment_status(self, obj):
        if obj.is_paid:
            return format_html(
                '<span style="color: green; font-weight: bold;">✓ Paid</span><br>'
                '<small>{}</small>',
                obj.paid_at.strftime('%Y-%m-%d') if obj.paid_at else 'Date unknown'
            )
        return format_html('<span style="color: red; font-weight: bold;">Unpaid</span>')

    payment_status.short_description = 'Payment Status'

    def mark_as_paid(self, request, queryset):
        """Mark commissions as paid"""
        from django.utils import timezone
        count = 0
        for commission in queryset.filter(is_paid=False):
            commission.is_paid = True
            commission.paid_at = timezone.now()
            commission.save()
            count += 1

        if count > 0:
            self.message_user(request, f"{count} commissions marked as paid")

    mark_as_paid.short_description = "Mark as paid"

    def mark_as_unpaid(self, request, queryset):
        """Mark commissions as unpaid"""
        count = 0
        for commission in queryset.filter(is_paid=True):
            commission.is_paid = False
            commission.paid_at = None
            commission.save()
            count += 1

        if count > 0:
            self.message_user(request, f"{count} commissions marked as unpaid")

    mark_as_unpaid.short_description = "Mark as unpaid"

    def export_commission_report(self, request, queryset):
        """Export commission report"""
        total_amount = sum(commission.commission_amount for commission in queryset)
        paid_amount = sum(commission.commission_amount for commission in queryset if commission.is_paid)
        unpaid_amount = total_amount - paid_amount

        self.message_user(
            request,
            f"Commission Report: {queryset.count()} records. "
            f"Total: ${total_amount:,.2f}, Paid: ${paid_amount:,.2f}, Unpaid: ${unpaid_amount:,.2f}"
        )

    export_commission_report.short_description = "Export commission report"


# NEW: Order Log Admin
@admin.register(OrderLog)
class OrderLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'order_link', 'action_display', 'performed_by', 'description_short']
    list_filter = ['action', 'timestamp']
    search_fields = ['order__id', 'performed_by__name', 'description']
    readonly_fields = ['timestamp']

    def order_link(self, obj):
        url = reverse('admin:tasks_order_change', args=[obj.order.id])
        return format_html('<a href="{}">Order #{}</a>', url, obj.order.id)

    order_link.short_description = 'Order'

    def action_display(self, obj):
        colors = {
            'order_created': '#60a5fa',
            'pricing_submitted': '#fbbf24',
            'customer_approved': '#34d399',
            'customer_rejected': '#f87171',
            'order_completed': '#10b981',
            'dealer_assigned': '#8b5cf6',
            'dealer_removed': '#ef4444',
        }
        color = colors.get(obj.action, '#9ca3af')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_action_display()
        )

    action_display.short_description = 'Action'

    def description_short(self, obj):
        if len(obj.description) > 50:
            return f"{obj.description[:50]}..."
        return obj.description

    description_short.short_description = 'Description'


# Update existing admins
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'base_price', 'stock', 'is_active', 'times_ordered', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['created_at']

    def times_ordered(self, obj):
        count = obj.orderitem_set.count()
        return f"{count} times"

    times_ordered.short_description = 'Ordered'


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = [
        'invoice_number', 'order_link', 'invoice_type', 'total_amount_display',
        'payable_amount_display', 'is_finalized', 'is_paid', 'has_pdf', 'issued_at'
    ]
    list_filter = ['invoice_type', 'is_finalized', 'is_paid', 'issued_at']
    search_fields = ['invoice_number', 'order__customer__name', 'order__id']
    readonly_fields = ['issued_at', 'tax_amount', 'payable_amount']

    def order_link(self, obj):
        url = reverse('admin:tasks_order_change', args=[obj.order.id])
        return format_html('<a href="{}">Order #{}</a>', url, obj.order.id)

    order_link.short_description = 'Order'

    def total_amount_display(self, obj):
        return f"${obj.total_amount:,.2f}"

    total_amount_display.short_description = 'Total Amount'

    def payable_amount_display(self, obj):
        return f"${obj.payable_amount:,.2f}"

    payable_amount_display.short_description = 'Payable Amount'

    def has_pdf(self, obj):
        if obj.pdf_file:
            return format_html('<a href="{}" target="_blank">📄 View PDF</a>', obj.pdf_file.url)
        return "❌ No PDF"

    has_pdf.short_description = 'PDF'


@admin.register(EmailNotification)
class EmailNotificationAdmin(admin.ModelAdmin):
    list_display = ['order_link', 'email_type_colored', 'recipient_email', 'subject_truncated', 'is_successful',
                    'sent_at']
    list_filter = ['email_type', 'is_successful', 'sent_at']
    search_fields = ['recipient_email', 'subject', 'order__id', 'order__customer__name']
    readonly_fields = ['sent_at']

    def order_link(self, obj):
        url = reverse('admin:tasks_order_change', args=[obj.order.id])
        return format_html('<a href="{}">Order #{}</a>', url, obj.order.id)

    order_link.short_description = 'Order'

    def email_type_colored(self, obj):
        colors = {
            'order_submitted': '#60a5fa',
            'pricing_ready': '#fbbf24',
            'order_confirmed': '#34d399',
            'order_rejected': '#f87171',
            'order_completed': '#10b981',
            'dealer_assigned': '#8b5cf6',
        }
        color = colors.get(obj.email_type, '#9ca3af')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_email_type_display()
        )

    email_type_colored.short_description = 'Email Type'

    def subject_truncated(self, obj):
        if len(obj.subject) > 50:
            return f"{obj.subject[:50]}..."
        return obj.subject

    subject_truncated.short_description = 'Subject'


# Customize admin site
admin.site.site_header = "Order Management System with Dealer Network"
admin.site.site_title = "OMS Admin"
admin.site.index_title = "Welcome to Order Management System"


@admin.register(SMSNotification)
class SMSNotificationAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'sms_type_colored', 'recipient_phone', 'is_successful_display',
        'order_link', 'message_preview', 'sent_at', 'cost'
    ]
    list_filter = ['sms_type', 'is_successful', 'sent_at']
    search_fields = ['recipient_phone', 'message', 'order__id', 'error_message']
    readonly_fields = ['sent_at', 'kavenegar_response', 'message_id']

    fieldsets = (
        ('SMS Information', {
            'fields': ['sms_type', 'recipient_phone', 'message']
        }),
        ('Status', {
            'fields': ['is_successful', 'sent_at', 'cost', 'message_id']
        }),
        ('Relations', {
            'fields': ['order', 'announcement', 'dealer'],
            'classes': ['collapse']
        }),
        ('Technical Details', {
            'fields': ['kavenegar_response', 'error_message'],
            'classes': ['collapse']
        }),
    )

    actions = ['resend_failed_sms', 'export_sms_report']

    def sms_type_colored(self, obj):
        """Display SMS type with color coding"""
        colors = {
            'order_submitted': '#60a5fa',
            'pricing_ready': '#fbbf24',
            'order_confirmed': '#34d399',
            'order_rejected': '#f87171',
            'order_completed': '#10b981',
            'dealer_assigned': '#8b5cf6',
            'otp': '#06b6d4',
            'test': '#9ca3af',
        }
        color = colors.get(obj.sms_type, '#9ca3af')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_sms_type_display()
        )

    sms_type_colored.short_description = 'SMS Type'

    def is_successful_display(self, obj):
        """Display success status with icons"""
        if obj.is_successful:
            return format_html('<span style="color: green; font-weight: bold;">✅ Sent</span>')
        else:
            return format_html('<span style="color: red; font-weight: bold;">❌ Failed</span>')

    is_successful_display.short_description = 'Status'

    def order_link(self, obj):
        """Display order link if applicable"""
        if obj.order:
            url = reverse('admin:tasks_order_change', args=[obj.order.id])
            return format_html('<a href="{}">Order #{}</a>', url, obj.order.id)
        elif obj.announcement:
            return format_html('Announcement #{} - {}', obj.announcement.id, obj.announcement.title[:30])
        return '-'

    order_link.short_description = 'Related'

    def message_preview(self, obj):
        """Display message preview"""
        if len(obj.message) > 50:
            return f"{obj.message[:50]}..."
        return obj.message

    message_preview.short_description = 'Message Preview'

    def resend_failed_sms(self, request, queryset):
        """Resend failed SMS messages"""
        failed_sms = queryset.filter(is_successful=False)

        if not failed_sms.exists():
            self.message_user(request, "No failed SMS messages selected")
            return

        try:
            sms_service = KavenegarSMSService()

            resent_count = 0
            for sms in failed_sms:
                try:
                    result = sms_service.send_sms(
                        receptor=sms.recipient_phone,
                        message=sms.message,
                        order=sms.order,
                        sms_type=f"{sms.sms_type}_retry"
                    )
                    if result['success']:
                        resent_count += 1
                except Exception as e:
                    continue

            self.message_user(
                request,
                f"Attempted to resend {failed_sms.count()} SMS messages. {resent_count} were successful."
            )

        except Exception as e:
            self.message_user(
                request,
                f"Error resending SMS: {str(e)}",
                level='ERROR'
            )

    resend_failed_sms.short_description = "Resend failed SMS messages"

    def export_sms_report(self, request, queryset):
        """Export SMS report"""
        total_sent = queryset.filter(is_successful=True).count()
        total_failed = queryset.filter(is_successful=False).count()
        total_cost = queryset.filter(cost__isnull=False).aggregate(
            total=models.Sum('cost')
        )['total'] or 0

        self.message_user(
            request,
            f"SMS Report: {queryset.count()} total, {total_sent} sent, {total_failed} failed. Total cost: {total_cost}"
        )

    export_sms_report.short_description = "Generate SMS report"


@admin.register(Customer)
class CustomerAdminEnhanced(admin.ModelAdmin):

    list_display = [
        'name', 'email', 'phone', 'company_name', 'is_staff',
        'is_dealer_display', 'total_orders', 'commission_info','is_active', 'last_login_display',
        'profile_completeness', 'date_joined'
    ]

    list_filter = ['is_staff', 'is_dealer', 'is_active', 'date_joined', 'last_login']
    search_fields = ['name', 'email', 'company_name', 'phone', 'dealer_code']
    readonly_fields = ['date_joined', 'last_login', 'dealer_code', 'password']

    fieldsets = (
        ('Basic Information', {
            'fields': ['name', 'email', 'phone', 'company_name']
        }),
        ('Account Status', {
            'fields': ['is_active', 'is_staff', 'is_superuser', 'password']
        }),
        ('Dealer Information', {
            'fields': ['is_dealer', 'dealer_code', 'dealer_commission_rate'],
            'classes': ['collapse']
        }),
        ('Timestamps', {
            'fields': ['date_joined', 'last_login'],
            'classes': ['collapse']
        }),
    )

    actions = ['send_password_reset', 'activate_users', 'deactivate_users',
               'make_dealer', 'remove_dealer', 'set_commission_rate']

    def is_dealer_display(self, obj):
        """Display dealer status with styling"""
        if obj.is_dealer:
            return format_html(
                '<span style="color: green; font-weight: bold;">✓ Dealer</span>'
            )
        return format_html('<span style="color: gray;">Customer</span>')

    is_dealer_display.short_description = 'Type'

    def last_login_display(self, obj):
        """Display last login with formatting"""
        if obj.last_login:
            return obj.last_login.strftime('%Y-%m-%d %H:%M')
        return format_html('<span style="color: red;">Never</span>')

    last_login_display.short_description = 'Last Login'

    def profile_completeness(self, obj):
        """Show profile completion percentage"""
        fields = ['name', 'phone', 'company_name']
        completed = sum(1 for field in fields if getattr(obj, field))
        percentage = (completed / len(fields)) * 100

        color = 'green' if percentage == 100 else 'orange' if percentage >= 50 else 'red'
        return format_html(
            '<span style="color: {};">{:.0f}%</span>',
            color, percentage
        )

    profile_completeness.short_description = 'Profile %'

    def send_password_reset(self, request, queryset):
        """Send password reset to selected users"""
        # This would integrate with your password reset system
        count = queryset.count()
        self.message_user(request, f"Password reset instructions would be sent to {count} users")

    send_password_reset.short_description = "Send password reset instructions"

    def activate_users(self, request, queryset):
        """Activate selected users"""
        count = queryset.update(is_active=True)
        self.message_user(request, f"{count} users activated")

    activate_users.short_description = "Activate selected users"

    def deactivate_users(self, request, queryset):
        """Deactivate selected users"""
        count = queryset.update(is_active=False)
        self.message_user(request, f"{count} users deactivated")

    deactivate_users.short_description = "Deactivate selected users"


    def total_orders(self, obj):
        """Display total orders count for customer"""
        if obj.is_dealer:
            count = obj.assigned_orders.count()
            if count > 0:
                url = reverse('admin:tasks_order_changelist') + f'?assigned_dealer__id__exact={obj.id}'
                return format_html('<a href="{}">{} assigned orders</a>', url, count)
            return '0 assigned orders'
        else:
            count = obj.order_set.count()
            if count > 0:
                url = reverse('admin:tasks_order_changelist') + f'?customer__id__exact={obj.id}'
                return format_html('<a href="{}">{} orders</a>', url, count)
            return '0 orders'

    total_orders.short_description = 'Orders'

    def commission_info(self, obj):
        """Display commission information for dealers"""
        if obj.is_dealer:
            rate = obj.dealer_commission_rate
            earned = obj.commissions.filter(is_paid=True).aggregate(
                total=Sum('commission_amount')
            )['total'] or Decimal('0.00')
            pending = obj.commissions.filter(is_paid=False).aggregate(
                total=Sum('commission_amount')
            )['total'] or Decimal('0.00')

            return format_html(
                'Rate: {}%<br>Earned: ${:,.2f}<br>Pending: ${:,.2f}',
                rate, float(earned), float(pending)
            )
        return '-'

    commission_info.short_description = 'Commission Info'

    def make_dealer(self, request, queryset):
        """Admin action to convert users to dealers"""
        count = 0
        for user in queryset.filter(is_dealer=False):
            user.is_dealer = True
            user.dealer_commission_rate = Decimal('5.00')  # Default 5%
            user.save()
            count += 1

        if count > 0:
            self.message_user(request, f"{count} users converted to dealers with 5% commission rate")

    make_dealer.short_description = "Convert to dealer (5% commission)"

    def remove_dealer(self, request, queryset):
        """Admin action to remove dealer status"""
        count = 0
        for user in queryset.filter(is_dealer=True):
            user.is_dealer = False
            user.dealer_commission_rate = Decimal('0.00')
            user.save()
            count += 1

        if count > 0:
            self.message_user(request, f"{count} dealers converted to regular users")

    remove_dealer.short_description = "Remove dealer status"

    def set_commission_rate(self, request, queryset):
        """Admin action to set commission rate - this would need a custom form"""
        # For now, just set to 10%
        count = 0
        for dealer in queryset.filter(is_dealer=True):
            dealer.dealer_commission_rate = Decimal('10.00')
            dealer.save()
            count += 1

        if count > 0:
            self.message_user(request, f"Commission rate set to 10% for {count} dealers")

    set_commission_rate.short_description = "Set commission rate to 10%"