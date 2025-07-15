from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone
from decimal import Decimal
import uuid
from django.conf import settings


class CustomerManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class Customer(AbstractBaseUser, PermissionsMixin):
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15)
    company_name = models.CharField(max_length=100, blank=True, null=True)
    date_joined = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = CustomerManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    def __str__(self):
        return self.email

# Product model
class Product(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.0 ,help_text="Base price for reference")
    stock = models.IntegerField(default=0)
    image_url = models.URLField(blank=True, null=True, help_text="URL to product image")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = 'products'


# Order model - Updated for your workflow
STATUS_CHOICES = [
    ('pending_pricing', 'Pending Pricing'),           # Customer submitted, waiting for admin to price
    ('waiting_customer_approval', 'Waiting Customer Approval'),  # Admin priced, waiting for customer
    ('confirmed', 'Confirmed'),                       # Customer approved the pricing
    ('rejected', 'Rejected'),                         # Customer rejected the pricing
    ('cancelled', 'Cancelled'),                       # Order cancelled
]

class Order(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending_pricing')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    customer_comment = models.TextField(blank=True, null=True, help_text="Customer's initial request/comments")
    admin_comment = models.TextField(blank=True, null=True, help_text="Admin's pricing notes")
    
    # Pricing fields (filled by admin)
    quoted_total = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Total quoted by admin")
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
        return sum(item.total_price for item in self.items.all())

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

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']


# Order item model - Updated for your workflow
class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    requested_quantity = models.IntegerField(default=1, help_text="Quantity requested by customer")
    customer_notes = models.TextField(blank=True, null=True, help_text="Special requirements from customer")
    
    # Admin pricing fields
    quoted_unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Price quoted by admin")
    final_quantity = models.IntegerField(default=0, help_text="Final quantity confirmed by admin")
    admin_notes = models.TextField(blank=True, null=True, help_text="Admin notes about pricing/availability")

    def __str__(self):
        return f"{self.requested_quantity} x {self.product.name} (Order {self.order.id})"

    @property
    def total_price(self):
        """Calculate total price for this item"""
        return self.final_quantity * self.quoted_unit_price

    @property
    def is_priced(self):
        """Check if admin has provided pricing"""
        return self.quoted_unit_price > 0

    class Meta:
        db_table = 'order_items'


# Invoice class - Updated for pre-invoice vs final invoice
class Invoice(models.Model):
    INVOICE_TYPE_CHOICES = [
        ('pre_invoice', 'Pre-Invoice'),      # Before customer approval
        ('final_invoice', 'Final Invoice'),  # After customer approval
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE)
    invoice_number = models.CharField(max_length=20, unique=True)
    invoice_type = models.CharField(max_length=15, choices=INVOICE_TYPE_CHOICES, default='pre_invoice')
    
    # Financial fields
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="Tax rate as percentage")
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    payable_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)  # Fixed decimal places
    
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
        tax_amount = subtotal * (self.tax_rate / 100)
        self.tax_amount = tax_amount
        self.payable_amount = subtotal + tax_amount
        return self.payable_amount

    def finalize_invoice(self):
        """Convert pre-invoice to final invoice"""
        if self.invoice_type == 'pre_invoice':
            self.invoice_type = 'final_invoice'
            self.is_finalized = True
            self.calculate_payable_amount()
            self.save()

    def save(self, *args, **kwargs):
        # Auto-calculate payable amount
        if self.total_amount:
            self.calculate_payable_amount()
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'invoices'
        ordering = ['-issued_at']


# Wallet class
class Wallet(models.Model):
    customer = models.OneToOneField(Customer, on_delete=models.CASCADE)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wallet for {self.customer.name} - Balance: {self.balance}"

    def add_funds(self, amount):
        """Add funds to wallet"""
        self.balance += Decimal(str(amount))
        self.save()

    def deduct_funds(self, amount):
        """Deduct funds from wallet"""
        if self.balance >= Decimal(str(amount)):
            self.balance -= Decimal(str(amount))
            self.save()
            return True
        return False

    class Meta:
        db_table = 'wallets'


# Payment class
PAYMENT_METHOD_CHOICES = [
    ('wallet', 'Wallet Payment'),
    ('credit_card', 'Credit Card'),
    ('bank_transfer', 'Bank Transfer'),
    ('cash', 'Cash'),
    ('check', 'Check'),
]

class Payment(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateTimeField(auto_now_add=True)
    payment_method = models.CharField(max_length=50, choices=PAYMENT_METHOD_CHOICES)
    transaction_id = models.CharField(max_length=100, unique=True)
    is_successful = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    
    # Reference fields
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    processed_by = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"Payment {self.transaction_id} - Invoice {self.invoice.invoice_number} - Amount: {self.amount}"

    def save(self, *args, **kwargs):
        if not self.transaction_id:
            self.transaction_id = str(uuid.uuid4())[:8].upper()
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'payments'
        ordering = ['-payment_date']