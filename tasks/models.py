from datetime import timedelta

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.core.files.base import ContentFile
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
import os

import logging
logger = logging.getLogger(__name__)


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
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class Customer(AbstractBaseUser, PermissionsMixin):
    # Basic user fields
    email = models.EmailField(unique=True, verbose_name='Email Address')
    name = models.CharField(max_length=100, verbose_name='Full Name')
    phone = models.CharField(max_length=15)
    company_name = models.CharField(max_length=100, blank=True, null=True)

    # Required for AbstractBaseUser
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_order_date = models.DateTimeField(null=True, blank=True)
    last_login = models.DateTimeField(null=True, blank=True)
    google_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        unique=True,
        help_text="Google OAuth user ID"
    )

    # Dealer fields
    is_dealer = models.BooleanField(default=False, help_text="Is this user a dealer?")
    dealer_code = models.CharField(max_length=20, blank=True, null=True, unique=True, help_text="Unique dealer code")
    dealer_commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Commission percentage"
    )

    # For invoice generation
    national_id = models.CharField(max_length=20, blank=True, null=True)
    economic_id = models.CharField(max_length=20, blank=True, null=True)
    postal_code = models.CharField(max_length=10, blank=True, null=True)
    complete_address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    province = models.CharField(max_length=100, blank=True, null=True)
    business_type = models.CharField(
        max_length=20,
        choices=[
            ('individual', 'شخص حقیقی'),
            ('company', 'شخص حقوقی')
        ],
        default='individual',
        help_text="نوع مشتری"
    )

    # Registration and tax information
    registration_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name="شماره ثبت شرکت"
    )
    tax_number = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name="شماره مالیاتی"
    )

    is_verified = models.BooleanField(default=False, verbose_name="تایید شده")
    preferred_invoice_type = models.CharField(
        max_length=20,
        choices=[
            ('unofficial', 'بدون مالیات'),
            ('official', 'رسمی'),
        ],
        default='unofficial',
        verbose_name="نوع فاکتور ترجیحی"
    )

    objects = CustomerManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    def clean(self):
        """Custom validation for official invoice requirements"""
        super().clean()

        if hasattr(self, 'order_set'):
            has_official_orders = self.order_set.filter(business_invoice_type='official').exists()
            if has_official_orders:
                missing_fields = []

                if not self.national_id:
                    missing_fields.append('شناسه ملی')
                if not self.complete_address:
                    missing_fields.append('آدرس کامل')
                if not self.postal_code:
                    missing_fields.append('کد پستی')

                if missing_fields:
                    raise ValidationError(
                        f"برای فاکتور رسمی این فیلدها الزامی است: {', '.join(missing_fields)}"
                    )

    def validate_for_official_invoice(self):
        """Validate customer data for official invoice generation"""
        missing_fields = []

        required_fields = {
            'national_id': 'شناسه ملی',
            'complete_address': 'آدرس کامل',
            'postal_code': 'کد پستی',
            'name': 'نام کامل',
            'phone': 'شماره تماس'
        }

        for field, label in required_fields.items():
            if not getattr(self, field, None) or str(getattr(self, field, '')).strip() == '':
                missing_fields.append(label)

        if self.postal_code and (len(self.postal_code) != 10 or not self.postal_code.isdigit()):
            missing_fields.append('کد پستی معتبر (۱۰ رقم)')

        if self.national_id and len(self.national_id) < 8:
            missing_fields.append('شناسه ملی معتبر (حداقل ۸ رقم)')

        if self.phone and not self.phone.startswith('09'):
            missing_fields.append('شماره تماس معتبر')

        return len(missing_fields) == 0, missing_fields

    def is_ready_for_official_invoice(self):
        """Check if customer is ready for official invoice generation"""
        is_ready, _ = self.validate_for_official_invoice()
        return is_ready

    def get_invoice_address(self):
        """Get formatted address for invoice"""
        address_parts = []

        if self.complete_address:
            address_parts.append(self.complete_address)

        if self.city and self.province:
            address_parts.append(f"{self.city}, {self.province}")
        elif self.city:
            address_parts.append(self.city)
        elif self.province:
            address_parts.append(self.province)

        if self.postal_code:
            address_parts.append(f"کد پستی: {self.postal_code}")

        return " - ".join(address_parts) if address_parts else ""

    def get_display_name(self):
        """Get customer display name"""
        if self.company_name:
            return f"{self.company_name} ({self.name})"
        return self.name or self.phone or self.email

    def get_full_address(self):
        """Get formatted full address"""
        parts = []
        if self.complete_address:
            parts.append(self.complete_address)
        if self.city:
            parts.append(self.city)
        if self.province:
            parts.append(self.province)
        if self.postal_code:
            parts.append(f"کد پستی: {self.postal_code}")
        return "، ".join(parts)

    def update_last_order_date(self):
        """Update last order date"""
        from django.utils import timezone
        self.last_order_date = timezone.now()
        self.save(update_fields=['last_order_date'])

    def __str__(self):
        return f"{self.name} ({self.email})"

    def has_perm(self, perm, obj=None):
        return True

    def has_module_perms(self, app_label):
        return True

    def save(self, *args, **kwargs):
        if self.is_dealer and not self.dealer_code:
            super().save(*args, **kwargs)

            import random
            timestamp = timezone.now().strftime('%Y%m%d')
            random_suffix = random.randint(100, 999)

            self.dealer_code = f"DLR{self.id:04d}{timestamp}{random_suffix}"

            while Customer.objects.filter(dealer_code=self.dealer_code).exists():
                random_suffix = random.randint(100, 999)
                self.dealer_code = f"DLR{self.id:04d}{timestamp}{random_suffix}"

            super().save(update_fields=['dealer_code'])
        else:
            super().save(*args, **kwargs)

    @property
    def assigned_orders_count(self):
        if self.is_dealer:
            return self.assigned_orders.count()
        return 0

    class Meta:
        db_table = 'customers'
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'


class ProductCategory(models.Model):
    name = models.CharField(max_length=100, help_text="English name")
    name_fa = models.CharField(max_length=100, help_text="Persian name", blank=True)
    description = models.TextField(blank=True, null=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='subcategories')
    slug = models.SlugField(unique=True, blank=True)
    image = models.ImageField(upload_to='categories/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0, help_text="Display order")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name_fa if self.name_fa else self.name

    @property
    def display_name(self):
        """Return Persian name if available, otherwise English name"""
        return self.name_fa if self.name_fa else self.name

    @property
    def products_count(self):
        return self.products.filter(is_active=True).count()

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'product_categories'
        verbose_name_plural = 'Product Categories'
        ordering = ['order', 'name']


class ProductImage(models.Model):
    product = models.ForeignKey('Product', on_delete=models.CASCADE, related_name='additional_images')
    image = models.ImageField(upload_to='products/additional/')
    alt_text = models.CharField(max_length=200, blank=True)
    order = models.IntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    def __str__(self):
        return f"Image for {self.product.name}"

    class Meta:
        db_table = 'product_images'
        ordering = ['order']


class Product(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField()
    base_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Base price for reference"
    )
    stock = models.IntegerField(default=0)
    image = models.ImageField(upload_to='products/', blank=True, null=True, help_text="Primary product image")
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    origin = models.CharField(max_length=100, blank=True, null=True, help_text="Country/place of origin")
    sku = models.CharField(max_length=50, null=True, blank=True, help_text="Stock Keeping Unit")

    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=10.00,
        help_text="Tax rate for this product as percentage",
        verbose_name="Tax Rate (%)"
    )

    category = models.ForeignKey(
        ProductCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='products',
        help_text="Product category"
    )
    weight = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="Weight in kg")

    # SEO and metadata
    meta_title = models.CharField(max_length=200, blank=True)
    meta_description = models.TextField(max_length=500, blank=True)
    tags = models.CharField(max_length=200, blank=True, help_text="Comma-separated tags")

    def __str__(self):
        return self.name

    @property
    def category_name(self):
        return self.category.display_name if self.category else None

    @property
    def is_out_of_stock(self):
        return self.stock <= 0

    @property
    def stock_status(self):
        if not self.is_active:
            return 'discontinued'
        elif self.is_out_of_stock:
            return 'out_of_stock'
        else:
            return 'in_stock'

    def get_primary_image_url(self):
        if self.image:
            return self.image.url
        primary_image = self.additional_images.filter(is_primary=True).first()
        if primary_image:
            return primary_image.image.url
        return None

    @classmethod
    def get_new_arrivals(cls, days=30):
        cutoff_date = timezone.now() - timedelta(days=days)
        return cls.objects.filter(
            created_at__gte=cutoff_date,
            is_active=True
        ).order_by('-created_at')

    @classmethod
    def get_out_of_stock_products(cls):
        return cls.objects.filter(
            is_active=True,
            stock__lte=0
        ).order_by('name')

    def get_tax_amount_for_price(self, price):
        """Calculate tax amount for given price"""
        if not price:
            return 0
        return price * (self.tax_rate / 100)

    def get_price_with_tax(self, base_price=None):
        """Get price including tax"""
        price = base_price or self.base_price
        return price + self.get_tax_amount_for_price(price)

    class Meta:
        db_table = 'products'


class ShipmentAnnouncement(models.Model):
    title = models.CharField(max_length=200, help_text="Title of the shipment announcement")
    description = models.TextField(help_text="Describe the new shipment, packaging, container info, etc.")

    image = models.ImageField(
        upload_to='shipments/',
        blank=True,
        null=True,
        help_text="Main photo of packaging/container"
    )

    origin_country = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Country of origin"
    )
    shipment_date = models.DateField(
        blank=True,
        null=True,
        help_text="Date when shipment was sent"
    )
    estimated_arrival = models.DateField(
        blank=True,
        null=True,
        help_text="Estimated arrival date"
    )
    product_categories = models.CharField(
        max_length=500,
        blank=True,
        null=True,
        help_text="Categories of products in this shipment"
    )

    related_products = models.ManyToManyField(
        'Product',
        blank=True,
        help_text="Products in this shipment"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'Customer',
        on_delete=models.CASCADE,
        related_name='shipment_announcements',
        help_text="Admin who created this announcement"
    )

    is_active = models.BooleanField(default=True, help_text="Is this announcement active?")
    is_featured = models.BooleanField(
        default=False,
        help_text="Show prominently on new arrivals page"
    )

    view_count = models.PositiveIntegerField(default=0, help_text="Number of times viewed")

    def __str__(self):
        return f"{self.title} - {self.created_at.strftime('%Y-%m-%d')}"

    @property
    def products_count(self):
        return self.related_products.count()

    def get_image_url(self):
        if self.image:
            return self.image.url

        first_additional = self.additional_images.first()
        if first_additional and first_additional.image:
            return first_additional.image.url

        return None

    def increment_view_count(self):
        """Increment view count"""
        self.view_count = models.F('view_count') + 1
        self.save(update_fields=['view_count'])

    class Meta:
        db_table = 'shipment_announcements'
        ordering = ['-created_at']
        verbose_name = 'Shipment Announcement'
        verbose_name_plural = 'Shipment Announcements'


class ShipmentAnnouncementImage(models.Model):
    """Additional images for shipment announcements"""
    announcement = models.ForeignKey(
        ShipmentAnnouncement,
        on_delete=models.CASCADE,
        related_name='additional_images'
    )
    image = models.ImageField(upload_to='shipments/images/')
    alt_text = models.CharField(max_length=200, blank=True)
    order = models.IntegerField(default=0, help_text="Display order")

    def __str__(self):
        return f"Image {self.order + 1} for {self.announcement.title}"

    class Meta:
        db_table = 'shipment_announcement_images'
        ordering = ['order']
        verbose_name = 'Shipment Announcement Image'
        verbose_name_plural = 'Shipment Announcement Images'


STATUS_CHOICES = [
    ('pending_pricing', 'Pending Pricing'),
    ('waiting_customer_approval', 'Waiting Customer Approval'),
    ('confirmed', 'Confirmed'),
    ('waiting_payment', 'Waiting Payment Receipt'),
    ('payment_uploaded', 'Payment Receipt Uploaded'),
    ('completed', 'Completed'),
    ('rejected', 'Rejected'),
    ('cancelled', 'Cancelled'),
]


class Order(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending_pricing')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    customer_comment = models.TextField(blank=True, null=True, help_text="Customer's initial request/comments")
    admin_comment = models.TextField(blank=True, null=True, help_text="Admin's pricing notes")

    BUSINESS_INVOICE_TYPE_CHOICES = [
        ('official', 'فاکتور رسمی'),
        ('unofficial', 'فاکتور شخصی'),
    ]

    # Dealer assignment
    assigned_dealer = models.ForeignKey(
        Customer,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_orders',
        help_text="Dealer assigned to this order"
    )
    dealer_assigned_at = models.DateTimeField(null=True, blank=True, help_text="When dealer was assigned")
    dealer_notes = models.TextField(blank=True, null=True, help_text="Notes from assigned dealer")
    custom_commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Custom commission rate for this order"
    )

    # Completion tracking
    completion_date = models.DateTimeField(blank=True, null=True, help_text="When order was completed")
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='completed_orders',
        help_text="Admin who completed the order"
    )

    # Pricing fields
    quoted_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total quoted by admin"
    )
    pricing_date = models.DateTimeField(blank=True, null=True, help_text="When admin provided pricing")
    priced_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='priced_orders'
    )
    admin_feedback_date = models.DateTimeField(blank=True, null=True)

    # Customer response
    customer_response_date = models.DateTimeField(blank=True, null=True)
    customer_rejection_reason = models.TextField(blank=True, null=True)

    business_invoice_type = models.CharField(
        max_length=15,
        choices=BUSINESS_INVOICE_TYPE_CHOICES,
        default='unofficial',
        help_text="Business type of invoice - Official (with tax) or Unofficial (without tax)"
    )

    # Payment Fields
    payment_receipt = models.ImageField(
        upload_to='payment_receipts/',
        blank=True,
        null=True,
        help_text="Legacy single payment receipt (deprecated)"
    )
    payment_receipt_uploaded_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When payment receipt was uploaded"
    )
    has_payment_receipts = models.BooleanField(
        default=False,
        help_text="True if order has any payment receipts uploaded"
    )
    payment_verified = models.BooleanField(
        default=False,
        help_text="Admin verified the payment receipt"
    )
    payment_verified_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When payment was verified by admin"
    )
    payment_verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='verified_payments',
        help_text="Admin who verified the payment"
    )
    payment_notes = models.TextField(
        blank=True,
        null=True,
        help_text="Admin notes about payment verification"
    )

    def __str__(self):
        return f"Order {self.id} - {self.customer.name} - {self.status}"

    def calculate_total_from_items(self):
        total = Decimal('0.00')
        for item in self.items.all():
            total += item.total_price
        return total

    def mark_as_priced_by_admin(self, admin_comment=None):
        self.status = 'waiting_customer_approval'
        self.pricing_date = timezone.now()
        self.quoted_total = self.calculate_total_from_items()
        if admin_comment:
            self.admin_comment = admin_comment
        self.save()

    def customer_approve(self):
        self.status = 'confirmed'
        self.customer_response_date = timezone.now()
        self.save()
        self.create_pre_invoice()

    def customer_reject(self, reason=None):
        self.status = 'rejected'
        self.customer_response_date = timezone.now()
        if reason:
            self.customer_rejection_reason = reason
        self.save()

    def create_pre_invoice(self):
        """Create pre-invoice when order is confirmed by customer"""
        if self.status == 'confirmed' and not hasattr(self, 'invoice'):
            try:
                invoice = Invoice.objects.create(
                    order=self,
                    invoice_type='pre_invoice',
                    invoice_number=self.generate_invoice_number(),
                    total_amount=self.quoted_total,
                    issued_at=timezone.now()
                )

                if self.business_invoice_type == 'official':
                    invoice.tax_rate = settings.DEFAULT_TAX_RATE * 100
                    invoice.calculate_payable_amount()
                else:
                    invoice.payable_amount = invoice.total_amount

                invoice.save()

                logger.info(f"📋 Pre-invoice created for Order #{self.id}")
                return invoice

            except Exception as e:
                logger.error(f"❌ Error creating pre-invoice for Order #{self.id}: {str(e)}")
                return None

    def upgrade_to_final_invoice(self, admin_user):
        """Upgrade pre-invoice to final invoice when payment is verified"""
        try:
            if hasattr(self, 'invoice'):
                invoice = self.invoice

                invoice.invoice_type = 'final_invoice'
                invoice.is_finalized = True
                invoice.is_paid = True
                invoice.save()

                logger.info(f"📋 Pre-invoice upgraded to final invoice for Order #{self.id}")

                OrderLog.objects.create(
                    order=self,
                    action='final_invoice_generated',
                    description=f"Pre-invoice upgraded to final invoice by {admin_user.name}",
                    performed_by=admin_user
                )

                return invoice
            else:
                return self.create_final_invoice_direct(admin_user)

        except Exception as e:
            logger.error(f"❌ Error upgrading to final invoice for Order #{self.id}: {str(e)}")
            return None

    def create_final_invoice_direct(self, admin_user):
        """Create final invoice directly (fallback method)"""
        try:
            invoice = Invoice.objects.create(
                order=self,
                invoice_type='final_invoice',
                invoice_number=self.generate_invoice_number(),
                total_amount=self.quoted_total,
                is_finalized=True,
                is_paid=True,
                issued_at=timezone.now()
            )

            if self.business_invoice_type == 'official':
                invoice.tax_rate = settings.DEFAULT_TAX_RATE * 100
                invoice.calculate_payable_amount()
            else:
                invoice.payable_amount = invoice.total_amount

            invoice.save()

            logger.info(f"📋 Final invoice created directly for Order #{self.id}")
            return invoice

        except Exception as e:
            logger.error(f"❌ Error creating final invoice for Order #{self.id}: {str(e)}")
            return None

    def mark_as_completed(self, admin_user):
        """Complete order and upgrade invoice to final"""
        if self.status not in ['payment_uploaded', 'confirmed']:
            raise ValueError("Order must have payment uploaded or be confirmed before completion")

        self.status = 'completed'
        self.completion_date = timezone.now()
        self.completed_by = admin_user
        self.payment_verified = True
        self.payment_verified_at = timezone.now()
        self.payment_verified_by = admin_user
        self.save()

        invoice = self.upgrade_to_final_invoice(admin_user)

        if self.assigned_dealer and self.dealer_commission_amount > 0:
            commission = DealerCommission.create_for_completed_order(self)
            if commission:
                logger.info(f"💰 Commission created for dealer {self.assigned_dealer.name}")

        return self, invoice

    def generate_invoice_number(self):
        """Generate unique invoice number"""
        import random
        timestamp = timezone.now().strftime('%Y%m%d')
        random_suffix = random.randint(1000, 9999)

        invoice_number = f"INV{timestamp}{random_suffix}{self.id:04d}"

        while Invoice.objects.filter(invoice_number=invoice_number).exists():
            random_suffix = random.randint(1000, 9999)
            invoice_number = f"INV{timestamp}{random_suffix}{self.id:04d}"

        return invoice_number

    def assign_dealer(self, dealer, assigned_by, custom_commission_rate=None):
        if not dealer.is_dealer:
            raise ValueError("User is not a dealer")

        old_dealer = self.assigned_dealer
        self.assigned_dealer = dealer
        self.dealer_assigned_at = timezone.now()

        if custom_commission_rate is not None:
            self.custom_commission_rate = custom_commission_rate

        self.save()

        OrderLog.objects.create(
            order=self,
            action='dealer_assigned',
            description=f"Dealer {dealer.name} assigned by {assigned_by.name}" +
                        (f" (replaced {old_dealer.name})" if old_dealer else "") +
                        (f" with custom commission rate {custom_commission_rate}%" if custom_commission_rate else ""),
            performed_by=assigned_by
        )

        return True

    def remove_dealer(self, removed_by):
        if self.assigned_dealer:
            old_dealer = self.assigned_dealer
            self.assigned_dealer = None
            self.dealer_assigned_at = None
            self.dealer_notes = ""
            self.save()

            OrderLog.objects.create(
                order=self,
                action='dealer_removed',
                description=f"Dealer {old_dealer.name} removed by {removed_by.name}",
                performed_by=removed_by
            )

            return True
        return False

    def update_dealer_notes(self, notes, updated_by):
        if self.assigned_dealer:
            self.dealer_notes = notes
            self.save()

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
        return self.assigned_dealer is not None

    @property
    def dealer_commission_amount(self):
        if self.assigned_dealer and self.status == 'completed' and self.quoted_total:
            commission_rate = self.custom_commission_rate or self.assigned_dealer.dealer_commission_rate

            if commission_rate > 0:
                return (self.quoted_total * commission_rate / Decimal('100')).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
        return Decimal('0.00')

    @property
    def effective_commission_rate(self):
        if self.custom_commission_rate is not None:
            return self.custom_commission_rate
        elif self.assigned_dealer:
            return self.assigned_dealer.dealer_commission_rate
        return Decimal('0.00')

    @property
    def all_payment_receipts(self):
        """Get all payment receipts for this order"""
        return self.payment_receipts.all().order_by('-uploaded_at')

    @property
    def verified_receipts_count(self):
        """Get count of verified payment receipts"""
        return self.payment_receipts.filter(is_verified=True).count()

    @property
    def total_receipts_count(self):
        """Get total count of payment receipts"""
        return self.payment_receipts.count()

    @property
    def can_generate_pre_invoice(self):
        """Check if pre-invoice can be generated"""
        return self.status == 'confirmed' and self.quoted_total > 0

    @property
    def can_generate_final_invoice(self):
        """Check if final invoice can be generated"""
        if self.status not in ['payment_uploaded', 'completed']:
            return False

        if self.business_invoice_type == 'official':
            is_valid, _ = self.customer.validate_for_official_invoice()
            return is_valid

        return True

    @property
    def invoice_type_display(self):
        """Get display name for invoice type"""
        return 'فاکتور رسمی' if self.business_invoice_type == 'official' else 'فاکتور شخصی'

    def get_tax_amount(self):
        """Calculate tax amount for official invoices"""
        if self.business_invoice_type == 'official' and self.quoted_total:
            tax_rate = Decimal(str(settings.DEFAULT_TAX_RATE))
            return self.quoted_total * tax_rate
        return Decimal('0.00')

    def get_total_with_tax(self):
        """Get total amount including tax for official invoices"""
        return self.quoted_total + self.get_tax_amount()

    @property
    def has_pre_invoice(self):
        """Check if order has a pre-invoice"""
        return hasattr(self, 'invoice') and self.invoice.invoice_type == 'pre_invoice'

    @property
    def has_final_invoice(self):
        """Check if order has a final invoice"""
        return hasattr(self, 'invoice') and self.invoice.invoice_type == 'final_invoice'

    @property
    def can_download_pre_invoice(self):
        """Check if pre-invoice can be downloaded"""
        return (
                self.status in ['confirmed', 'payment_uploaded'] and
                self.has_pre_invoice and
                self.quoted_total > 0
        )

    @property
    def can_download_final_invoice(self):
        """Check if final invoice can be downloaded"""
        return (
                self.status == 'completed' and
                self.has_final_invoice and
                self.payment_verified
        )

    def get_tax_breakdown(self):
        """Get detailed tax breakdown for order with different tax rates per product"""
        tax_breakdown = {}
        total_before_tax = 0
        total_tax = 0

        for item in self.items.all():
            if item.quoted_unit_price and item.final_quantity:
                subtotal = item.quoted_unit_price * item.final_quantity
                tax_rate = float(item.product.tax_rate)
                tax_amount = subtotal * (tax_rate / 100)

                total_before_tax += float(subtotal)
                total_tax += float(tax_amount)

                # Group by tax rate
                if tax_rate not in tax_breakdown:
                    tax_breakdown[tax_rate] = {
                        'rate': tax_rate,
                        'subtotal': 0,
                        'tax_amount': 0,
                        'items': []
                    }

                tax_breakdown[tax_rate]['subtotal'] += float(subtotal)
                tax_breakdown[tax_rate]['tax_amount'] += float(tax_amount)
                tax_breakdown[tax_rate]['items'].append({
                    'product_name': item.product.name,
                    'product_sku': item.product.sku,
                    'quantity': item.final_quantity,
                    'unit_price': float(item.quoted_unit_price),
                    'subtotal': float(subtotal),
                    'tax_rate': tax_rate,
                    'tax_amount': float(tax_amount),
                    'total_with_tax': float(subtotal + tax_amount)
                })

        return {
            'breakdown_by_rate': tax_breakdown,
            'total_before_tax': total_before_tax,
            'total_tax': total_tax,
            'total_with_tax': total_before_tax + total_tax,
            'has_mixed_rates': len(tax_breakdown) > 1
        }

    def get_order_total_with_tax(self):
        """Get order total including all product-specific taxes"""
        return self.get_tax_breakdown()['total_with_tax']

    def get_order_total_tax(self):
        """Get total tax amount for the entire order"""
        return self.get_tax_breakdown()['total_tax']

    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']

class OrderItem(models.Model):
    order = models.ForeignKey(Order, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    requested_quantity = models.IntegerField(default=1, help_text="Quantity requested by customer")
    customer_notes = models.TextField(blank=True, null=True, help_text="Special requirements from customer")

    # Admin pricing fields
    quoted_unit_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Price quoted by admin"
    )
    final_quantity = models.IntegerField(default=0, help_text="Final quantity confirmed by admin")
    admin_notes = models.TextField(blank=True, null=True, help_text="Admin notes about pricing/availability")

    def __str__(self):
        return f"{self.requested_quantity} x {self.product.name} (Order {self.order.id})"

    @property
    def total_price(self):
        if self.final_quantity and self.quoted_unit_price:
            return Decimal(str(self.final_quantity)) * self.quoted_unit_price
        return Decimal('0.00')

    @property
    def is_priced(self):
        return self.quoted_unit_price > Decimal('0.00')

    class Meta:
        db_table = 'order_items'


class Invoice(models.Model):
    INVOICE_TYPE_CHOICES = [
        ('pre_invoice', 'Pre-Invoice'),
        ('final_invoice', 'Final Invoice'),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE)
    invoice_number = models.CharField(max_length=20, unique=True)
    invoice_type = models.CharField(max_length=15, choices=INVOICE_TYPE_CHOICES, default='pre_invoice')

    # Financial fields
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Tax rate as percentage"
    )
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
        subtotal = self.total_amount - self.discount
        tax_amount = subtotal * (self.tax_rate / Decimal('100'))
        self.tax_amount = tax_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        self.payable_amount = (subtotal + tax_amount).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return self.payable_amount

    def finalize_invoice(self):
        if self.invoice_type == 'pre_invoice':
            self.invoice_type = 'final_invoice'
            self.is_finalized = True
            self.calculate_payable_amount()
            self.save()

    def save(self, *args, **kwargs):
        if self.total_amount:
            self.calculate_payable_amount()
        super().save(*args, **kwargs)

    class Meta:
        db_table = 'invoices'
        ordering = ['-issued_at']


class InvoiceTemplate(models.Model):
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


class EmailNotification(models.Model):
    EMAIL_TYPES = [
        ('order_submitted', 'Order Submitted'),
        ('pricing_ready', 'Pricing Ready'),
        ('order_confirmed', 'Order Confirmed'),
        ('order_rejected', 'Order Rejected'),
        ('order_completed', 'Order Completed'),
        ('dealer_assigned', 'Dealer Assigned'),
        ('dealer_removed', 'Dealer Removed'),
        ('new_arrival_customer', 'New Arrival - Customer'),
        ('new_arrival_dealer', 'New Arrival - Dealer'),
        ('announcement_updated', 'Announcement Updated'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    email_type = models.CharField(max_length=20, choices=EMAIL_TYPES)
    recipient_email = models.EmailField()
    subject = models.CharField(max_length=200)
    sent_at = models.DateTimeField(auto_now_add=True)
    is_successful = models.BooleanField(default=False)
    error_message = models.TextField(blank=True, null=True)

    announcement = models.ForeignKey(
        'ShipmentAnnouncement',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text="Related announcement for announcement emails"
    )

    dealer = models.ForeignKey(
        'Customer',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='received_notifications',
        help_text="Dealer who received the notification"
    )

    def __str__(self):
        if self.order:
            return f"{self.get_email_type_display()} - {self.recipient_email} - Order #{self.order.id}"
        elif self.announcement:
            return f"{self.get_email_type_display()} - {self.recipient_email} - Announcement #{self.announcement.id}"
        else:
            return f"{self.get_email_type_display()} - {self.recipient_email}"

    class Meta:
        db_table = 'email_notifications'
        ordering = ['-sent_at']


class SMSNotification(models.Model):
    """Track SMS notifications sent via Kavenegar"""
    SMS_TYPES = [
        ('order_submitted', 'Order Submitted'),
        ('pricing_ready', 'Pricing Ready'),
        ('order_confirmed', 'Order Confirmed'),
        ('order_rejected', 'Order Rejected'),
        ('order_completed', 'Order Completed'),
        ('dealer_assigned', 'Dealer Assigned'),
        ('new_arrival_customer', 'New Arrival - Customer'),
        ('new_arrival_dealer', 'New Arrival - Dealer'),
        ('commission_paid', 'Commission Paid'),
        ('otp', 'OTP Verification'),
        ('general', 'General Notification'),
        ('test', 'Test Message'),
        ('bulk', 'Bulk Message'),
    ]

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='sms_notifications',
        null=True,
        blank=True,
        help_text="Related order (if applicable)"
    )

    announcement = models.ForeignKey(
        'ShipmentAnnouncement',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='sms_notifications',
        help_text="Related announcement (if applicable)"
    )

    dealer = models.ForeignKey(
        'Customer',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='received_sms_notifications',
        help_text="Dealer who received the SMS (if applicable)"
    )

    sms_type = models.CharField(max_length=30, choices=SMS_TYPES, default='general')
    recipient_phone = models.CharField(max_length=20, help_text="Phone number(s) SMS was sent to")
    message = models.TextField(max_length=500, help_text="SMS message content")

    # Response tracking
    is_successful = models.BooleanField(default=False)
    kavenegar_response = models.TextField(blank=True, null=True, help_text="Kavenegar API response")
    error_message = models.TextField(blank=True, null=True)

    # Metadata
    sent_at = models.DateTimeField(auto_now_add=True)
    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="SMS cost (if provided by API)"
    )
    message_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Kavenegar message ID"
    )

    def __str__(self):
        status = "✅" if self.is_successful else "❌"
        if self.order:
            return f"{status} SMS {self.get_sms_type_display()} - Order #{self.order.id} - {self.recipient_phone}"
        elif self.announcement:
            return f"{status} SMS {self.get_sms_type_display()} - Announcement #{self.announcement.id} - {self.recipient_phone}"
        else:
            return f"{status} SMS {self.get_sms_type_display()} - {self.recipient_phone}"

    class Meta:
        db_table = 'sms_notifications'
        ordering = ['-sent_at']
        verbose_name = 'SMS Notification'
        verbose_name_plural = 'SMS Notifications'


class OrderLog(models.Model):
    ACTION_CHOICES = [
        ('order_created', 'Order Created'),
        ('pricing_submitted', 'Pricing Submitted'),
        ('customer_approved', 'Customer Approved'),
        ('customer_rejected', 'Customer Rejected'),
        ('order_completed', 'Order Completed'),
        ('dealer_assigned', 'Dealer Assigned'),
        ('dealer_removed', 'Dealer Removed'),
        ('dealer_notes_updated', 'Dealer Notes Updated'),
        ('payment_receipts_uploaded', 'Payment Receipts Uploaded'),
        ('payment_verified', 'Payment Verified'),
        ('payment_rejected', 'Payment Rejected'),
        ('invoice_type_changed', 'Invoice Type Changed'),
        ('pre_invoice_generated', 'Pre-Invoice Generated'),
        ('final_invoice_generated', 'Final Invoice Generated'),
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


class DealerCommission(models.Model):
    dealer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='commissions')
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='commission')
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Commission percentage at time of completion"
    )
    commission_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Calculated commission amount"
    )
    order_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Order total at time of completion"
    )

    # Payment tracking
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Commission for {self.dealer.name} - Order #{self.order.id} - {self.commission_amount}"

    @classmethod
    def create_for_completed_order(cls, order):
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


class OrderPaymentReceipt(models.Model):
    """Model for storing multiple payment receipts per order"""

    FILE_TYPE_CHOICES = [
        ('image', 'Image'),
        ('pdf', 'PDF'),
    ]

    order = models.ForeignKey(
        'Order',
        on_delete=models.CASCADE,
        related_name='payment_receipts'
    )

    def receipt_upload_path(instance, filename):
        """Generate upload path for receipt files"""
        # Clean filename
        name, ext = os.path.splitext(filename)
        clean_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        clean_filename = f"{clean_name}{ext}"

        return f'payment_receipts/order_{instance.order.id}/{clean_filename}'

    receipt_file = models.FileField(
        upload_to=receipt_upload_path,
        help_text="Payment receipt file (image or PDF)"
    )

    file_type = models.CharField(
        max_length=10,
        choices=FILE_TYPE_CHOICES,
        help_text="Type of uploaded file"
    )

    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        help_text="User who uploaded this receipt"
    )

    # Admin verification fields
    is_verified = models.BooleanField(
        default=False,
        help_text="Whether this receipt has been verified by admin"
    )
    verified_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this receipt was verified"
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_receipts',
        help_text="Admin who verified this receipt"
    )

    admin_notes = models.TextField(
        blank=True,
        help_text="Admin notes about this receipt"
    )

    class Meta:
        db_table = 'order_payment_receipts'
        ordering = ['-uploaded_at']
        verbose_name = 'Payment Receipt'
        verbose_name_plural = 'Payment Receipts'

    def __str__(self):
        return f"Receipt for Order #{self.order.id} - {self.file_name}"

    @property
    def file_name(self):
        """Get the filename of the uploaded file"""
        if self.receipt_file and self.receipt_file.name:
            return os.path.basename(self.receipt_file.name)
        return f"receipt_{self.id}"

    @property
    def file_size(self):
        """Get the file size in bytes"""
        try:
            if self.receipt_file and hasattr(self.receipt_file, 'size'):
                return self.receipt_file.size
            elif self.receipt_file and self.receipt_file.name:
                return self.receipt_file.file.size
        except (ValueError, FileNotFoundError, OSError):
            pass
        return 0

    def save(self, *args, **kwargs):
        """Override save to determine file type automatically"""
        if self.receipt_file and not self.file_type:
            # Determine file type based on content type or extension
            if hasattr(self.receipt_file, 'content_type'):
                content_type = self.receipt_file.content_type.lower()
                if content_type == 'application/pdf':
                    self.file_type = 'pdf'
                elif content_type.startswith('image/'):
                    self.file_type = 'image'

            # Fallback: determine by file extension
            if not self.file_type and self.receipt_file.name:
                ext = os.path.splitext(self.receipt_file.name)[1].lower()
                if ext == '.pdf':
                    self.file_type = 'pdf'
                elif ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    self.file_type = 'image'
                else:
                    self.file_type = 'image'  # Default fallback

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Override delete to remove file from filesystem"""
        # Delete the file when the model instance is deleted
        if self.receipt_file:
            try:
                if os.path.isfile(self.receipt_file.path):
                    os.remove(self.receipt_file.path)
            except (ValueError, FileNotFoundError, OSError) as e:
                print(f"Warning: Could not delete file {self.receipt_file.name}: {e}")

        super().delete(*args, **kwargs)