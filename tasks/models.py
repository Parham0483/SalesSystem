# tasks/models.py - Final Complete Version with Dealer System
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone
from django.core.files.base import ContentFile
from decimal import Decimal, ROUND_HALF_UP
from .services.simple_persian_pdf import SimpleInvoicePDFGenerator
import uuid
from django.conf import settings
import os


class CustomerManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # This properly hashes the password
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class Customer(AbstractBaseUser, PermissionsMixin):
    # Required fields for AbstractBaseUser
    email = models.EmailField(unique=True, verbose_name='Email Address')
    name = models.CharField(max_length=100, verbose_name='Full Name')
    phone = models.CharField(max_length=15)
    company_name = models.CharField(max_length=100, blank=True, null=True)

    # Required for AbstractBaseUser
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    # DEALER FIELDS
    is_dealer = models.BooleanField(default=False, help_text="Is this user a dealer?")
    dealer_code = models.CharField(max_length=20, blank=True, null=True, unique=True, help_text="Unique dealer code")
    dealer_commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'),
                                                 help_text="Commission percentage")

    objects = CustomerManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    def __str__(self):
        return f"{self.name} ({self.email})"

    def has_perm(self, perm, obj=None):
        """Does the user have a specific permission?"""
        return True

    def has_module_perms(self, app_label):
        """Does the user have permissions to view the app `app_label`?"""
        return True

    def save(self, *args, **kwargs):
        # Auto-generate dealer code if user is marked as dealer
        if self.is_dealer and not self.dealer_code:
            self.dealer_code = f"DLR{self.id or ''}{timezone.now().strftime('%Y%m')}"
        super().save(*args, **kwargs)

    @property
    def assigned_orders_count(self):
        """Get count of orders assigned to this dealer"""
        if self.is_dealer:
            return self.assigned_orders.count()
        return 0

    class Meta:
        db_table = 'customers'
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'


class Product(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'),
                                     help_text="Base price for reference")
    stock = models.IntegerField(default=0)
    image_url = models.URLField(blank=True, null=True, help_text="URL to product image")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'products'


# Updated STATUS_CHOICES with completed status
STATUS_CHOICES = [
    ('pending_pricing', 'Pending Pricing'),  # Customer submitted, waiting for admin to price
    ('waiting_customer_approval', 'Waiting Customer Approval'),  # Admin priced, waiting for customer
    ('confirmed', 'Confirmed'),  # Customer approved the pricing
    ('completed', 'Completed'),  # Order completed and finalized
    ('rejected', 'Rejected'),  # Customer rejected the pricing
    ('cancelled', 'Cancelled'),  # Order cancelled
]


class Order(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending_pricing')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    customer_comment = models.TextField(blank=True, null=True, help_text="Customer's initial request/comments")
    admin_comment = models.TextField(blank=True, null=True, help_text="Admin's pricing notes")

    # DEALER ASSIGNMENT FIELDS
    assigned_dealer = models.ForeignKey(
        Customer,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_orders',
        help_text="Dealer assigned to this order"
    )
    dealer_assigned_at = models.DateTimeField(null=True, blank=True, help_text="When dealer was assigned")
    dealer_notes = models.TextField(blank=True, null=True, help_text="Notes from assigned dealer")

    # Completion tracking fields
    completion_date = models.DateTimeField(blank=True, null=True, help_text="When order was completed")
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='completed_orders',
        help_text="Admin who completed the order"
    )

    # Pricing fields
    quoted_total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'),
                                       help_text="Total quoted by admin")
    pricing_date = models.DateTimeField(blank=True, null=True, help_text="When admin provided pricing")
    priced_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                  related_name='priced_orders')
    admin_feedback_date = models.DateTimeField(blank=True, null=True)

    # Customer response
    customer_response_date = models.DateTimeField(blank=True, null=True)
    customer_rejection_reason = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Order {self.id} - {self.customer.name} - {self.status}"

    def calculate_total_from_items(self):
        """Calculate total from order items (after admin pricing)"""
        total = Decimal('0.00')
        for item in self.items.all():
            total += item.total_price
        return total

    def mark_as_priced_by_admin(self, admin_comment=None):
        """Admin marks order as priced and ready for customer approval"""
        self.status = 'waiting_customer_approval'
        self.pricing_date = timezone.now()
        self.quoted_total = self.calculate_total_from_items()
        if admin_comment:
            self.admin_comment = admin_comment
        self.save()

    def customer_approve(self):
        """Customer approves the pricing"""
        self.status = 'confirmed'
        self.customer_response_date = timezone.now()
        self.save()
        # Auto-create finalized invoice
        self.create_final_invoice()

    def customer_reject(self, reason=None):
        """Customer rejects the pricing"""
        self.status = 'rejected'
        self.customer_response_date = timezone.now()
        if reason:
            self.customer_rejection_reason = reason
        self.save()

    def mark_as_completed(self, admin_user):
        """Mark order as completed"""
        if self.status != 'confirmed':
            raise ValueError("Order must be confirmed before completion")

        self.status = 'completed'
        self.completion_date = timezone.now()
        self.completed_by = admin_user
        self.save()

        # Create final invoice if not exists and generate PDF
        invoice, created = Invoice.objects.get_or_create(
            order=self,
            defaults={
                'invoice_type': 'final_invoice',
                'total_amount': self.quoted_total,
                'is_finalized': True,
                'invoice_number': self.generate_invoice_number() if not hasattr(self,
                                                                                'invoice') else self.invoice.invoice_number
            }
        )

        # Generate PDF if not exists
        if created or not invoice.pdf_file:
            invoice.generate_pdf()

        return self, invoice

    def create_final_invoice(self):
        """Create finalized invoice after customer approval"""
        if self.status == 'confirmed' and not hasattr(self, 'invoice'):
            invoice = Invoice.objects.create(
                order=self,
                total_amount=self.quoted_total,
                is_finalized=True,
                invoice_number=self.generate_invoice_number()
            )
            return invoice

    def generate_invoice_number(self):
        """Generate unique invoice number"""
        return f"INV-{timezone.now().year}-{self.id:06d}"

    # DEALER MANAGEMENT METHODS
    def assign_dealer(self, dealer, assigned_by):
        """Assign a dealer to this order"""
        if not dealer.is_dealer:
            raise ValueError("User is not a dealer")

        old_dealer = self.assigned_dealer
        self.assigned_dealer = dealer
        self.dealer_assigned_at = timezone.now()
        self.save()

        # Log the assignment
        OrderLog.objects.create(
            order=self,
            action='dealer_assigned',
            description=f"Dealer {dealer.name} assigned by {assigned_by.name}" +
                        (f" (replaced {old_dealer.name})" if old_dealer else ""),
            performed_by=assigned_by
        )

        return True

    def remove_dealer(self, removed_by):
        """Remove dealer from this order"""
        if self.assigned_dealer:
            old_dealer = self.assigned_dealer
            self.assigned_dealer = None
            self.dealer_assigned_at = None
            self.dealer_notes = ""
            self.save()

            # Log the removal
            OrderLog.objects.create(
                order=self,
                action='dealer_removed',
                description=f"Dealer {old_dealer.name} removed by {removed_by.name}",
                performed_by=removed_by
            )

            return True
        return False

    def update_dealer_notes(self, notes, updated_by):
        """Update dealer notes"""
        if self.assigned_dealer:
            self.dealer_notes = notes
            self.save()

            # Log the update
            OrderLog.objects.create(
                order=self,
                action='dealer_notes_updated',
                description=f"Dealer notes updated by {updated_by.name}",
                performed_by=updated_by
            )

            return True
        return False

    @property
    def has_dealer(self):
        """Check if order has an assigned dealer"""
        return self.assigned_dealer is not None

    @property
    def dealer_commission_amount(self):
        """Calculate dealer commission amount if applicable"""
        if self.assigned_dealer and self.status == 'completed' and self.quoted_total:
            commission_rate = self.assigned_dealer.dealer_commission_rate
            if commission_rate > 0:
                return (self.quoted_total * commission_rate / Decimal('100')).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
        return Decimal('0.00')

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']


class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    requested_quantity = models.IntegerField(default=1, help_text="Quantity requested by customer")
    customer_notes = models.TextField(blank=True, null=True, help_text="Special requirements from customer")

    # Admin pricing fields: Use Decimal consistently
    quoted_unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'),
                                            help_text="Price quoted by admin")
    final_quantity = models.IntegerField(default=0, help_text="Final quantity confirmed by admin")
    admin_notes = models.TextField(blank=True, null=True, help_text="Admin notes about pricing/availability")

    def __str__(self):
        return f"{self.requested_quantity} x {self.product.name} (Order {self.order.id})"

    @property
    def total_price(self):
        """Calculate total price for this item: Use Decimal"""
        if self.final_quantity and self.quoted_unit_price:
            return Decimal(str(self.final_quantity)) * self.quoted_unit_price
        return Decimal('0.00')

    @property
    def is_priced(self):
        """Check if admin has provided pricing"""
        return self.quoted_unit_price > Decimal('0.00')

    class Meta:
        db_table = 'order_items'


class Invoice(models.Model):
    INVOICE_TYPE_CHOICES = [
        ('pre_invoice', 'Pre-Invoice'),  # Before customer approval
        ('final_invoice', 'Final Invoice'),  # After customer approval
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE)
    invoice_number = models.CharField(max_length=20, unique=True)
    invoice_type = models.CharField(max_length=15, choices=INVOICE_TYPE_CHOICES, default='pre_invoice')

    # Financial fields: Use Decimal consistently
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'),
                                   help_text="Tax rate as percentage")
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    payable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Status fields
    issued_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateTimeField(blank=True, null=True)
    is_finalized = models.BooleanField(default=False)
    is_paid = models.BooleanField(default=False)

    # File storage
    pdf_file = models.FileField(upload_to='invoices/', blank=True, null=True)

    def __str__(self):
        return f"Invoice {self.invoice_number} - Order {self.order.id} - {self.invoice_type}"

    def calculate_payable_amount(self):
        """Calculate final payable amount"""
        subtotal = self.total_amount - self.discount
        tax_amount = subtotal * (self.tax_rate / Decimal('100'))
        self.tax_amount = tax_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        self.payable_amount = (subtotal + tax_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return self.payable_amount

    def finalize_invoice(self):
        """Convert pre-invoice to final invoice"""
        if self.invoice_type == 'pre_invoice':
            self.invoice_type = 'final_invoice'
            self.is_finalized = True
            self.calculate_payable_amount()
            self.save()

    # PDF generation methods
    def generate_pdf(self):
        """Generate PDF for this invoice"""
        generator = SimpleInvoicePDFGenerator(self)
        pdf_buffer = generator.generate_pdf()

        # Save PDF to file field
        filename = f"invoice_{self.invoice_number}.pdf"
        self.pdf_file.save(filename, ContentFile(pdf_buffer.getvalue()))
        return self.pdf_file

    def download_pdf_response(self):
        """Get HTTP response for PDF download"""
        generator = SimpleInvoicePDFGenerator(self)
        return generator.get_http_response()

    def save(self, *args, **kwargs):
        # Auto-calculate payable amount
        if self.total_amount:
            self.calculate_payable_amount()
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'invoices'
        ordering = ['-issued_at']


# Template system for customizable invoices
class InvoiceTemplate(models.Model):
    """Template configuration for invoices"""
    name = models.CharField(max_length=100, unique=True)
    language = models.CharField(max_length=10, choices=[('fa', 'Persian'), ('en', 'English')], default='fa')
    is_active = models.BooleanField(default=True)
    company_info = models.JSONField(default=dict, help_text="Store company details")
    font_family = models.CharField(max_length=50, default='Vazir')
    page_size = models.CharField(max_length=10, default='A4')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_language_display()})"

    class Meta:
        db_table = 'invoice_templates'
        verbose_name = 'Invoice Template'
        verbose_name_plural = 'Invoice Templates'


class InvoiceTemplateField(models.Model):
    """Define fields and their labels for invoice templates"""
    template = models.ForeignKey(InvoiceTemplate, on_delete=models.CASCADE, related_name='fields')
    field_key = models.CharField(max_length=50, help_text="e.g., 'customer_name', 'total_amount'")
    field_label = models.CharField(max_length=100, help_text="e.g., 'نام مشتری', 'مبلغ کل'")
    field_type = models.CharField(max_length=20, choices=[
        ('text', 'Text'),
        ('number', 'Number'),
        ('price', 'Price'),
        ('date', 'Date'),
        ('email', 'Email')
    ], default='text')
    is_required = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)
    section = models.CharField(max_length=50, help_text="e.g., 'company', 'customer', 'items', 'totals'")

    def __str__(self):
        return f"{self.template.name} - {self.field_label}"

    class Meta:
        db_table = 'invoice_template_fields'
        ordering = ['section', 'display_order']
        unique_together = ['template', 'field_key']


class InvoiceSection(models.Model):
    """Define sections and their layout in invoice"""
    template = models.ForeignKey(InvoiceTemplate, on_delete=models.CASCADE, related_name='sections')
    section_key = models.CharField(max_length=50)
    section_title = models.CharField(max_length=100)
    display_order = models.IntegerField(default=0)
    is_table = models.BooleanField(default=False, help_text="True for items table")
    table_columns = models.JSONField(default=list, help_text="Column definitions for tables")

    def __str__(self):
        return f"{self.template.name} - {self.section_title}"

    class Meta:
        db_table = 'invoice_sections'
        ordering = ['display_order']
        unique_together = ['template', 'section_key']


# Email notification tracking
class EmailNotification(models.Model):
    """Track email notifications sent"""
    EMAIL_TYPES = [
        ('order_submitted', 'Order Submitted'),
        ('pricing_ready', 'Pricing Ready'),
        ('order_confirmed', 'Order Confirmed'),
        ('order_rejected', 'Order Rejected'),
        ('order_completed', 'Order Completed'),
        ('dealer_assigned', 'Dealer Assigned'),  # NEW
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='notifications')
    email_type = models.CharField(max_length=20, choices=EMAIL_TYPES)
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=200)
    sent_at = models.DateTimeField(auto_now_add=True)
    is_successful = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.get_email_type_display()} - {self.recipient_email} - Order #{self.order.id}"

    class Meta:
        db_table = 'email_notifications'
        ordering = ['-sent_at']


class OrderLog(models.Model):
    """Track all actions performed on orders"""
    ACTION_CHOICES = [
        ('order_created', 'Order Created'),
        ('pricing_submitted', 'Pricing Submitted'),
        ('customer_approved', 'Customer Approved'),
        ('customer_rejected', 'Customer Rejected'),
        ('order_completed', 'Order Completed'),
        ('dealer_assigned', 'Dealer Assigned'),
        ('dealer_removed', 'Dealer Removed'),
        ('dealer_notes_updated', 'Dealer Notes Updated'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='logs')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField()
    performed_by = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order #{self.order.id} - {self.get_action_display()} by {self.performed_by}"

    class Meta:
        db_table = 'order_logs'
        ordering = ['-timestamp']


# NEW: Dealer Commission Tracking
class DealerCommission(models.Model):
    """Track dealer commissions for completed orders"""
    dealer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='commissions')
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='commission')
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2,
                                          help_text="Commission percentage at time of completion")
    commission_amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Calculated commission amount")
    order_total = models.DecimalField(max_digits=12, decimal_places=2, help_text="Order total at time of completion")

    # Payment tracking
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Commission for {self.dealer.name} - Order #{self.order.id} - {self.commission_amount}"

    @classmethod
    def create_for_completed_order(cls, order):
        """Create commission record when order is completed"""
        if order.assigned_dealer and order.status == 'completed':
            commission, created = cls.objects.get_or_create(
                dealer=order.assigned_dealer,
                order=order,
                defaults={
                    'commission_rate': order.assigned_dealer.dealer_commission_rate,
                    'commission_amount': order.dealer_commission_amount,
                    'order_total': order.quoted_total,
                }
            )
            return commission
        return None

    class Meta:
        db_table = 'dealer_commissions'
        ordering = ['-created_at']