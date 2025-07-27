# tasks/management/commands/test_new_email_features.py

from django.core.management.base import BaseCommand
from django.utils import timezone
from tasks.models import Customer, Order, ShipmentAnnouncement, DealerCommission
from tasks.services.notification_service import NotificationService
from decimal import Decimal


class Command(BaseCommand):
    help = 'Test the new email notification features'

    def add_arguments(self, parser):
        parser.add_argument(
            '--feature',
            type=str,
            choices=['new_arrival', 'dealer_assignment', 'commission_payment', 'all'],
            default='all',
            help='Which feature to test',
        )
        parser.add_argument(
            '--email',
            type=str,
            help='Test email address to send notifications to',
        )

    def handle(self, *args, **options):
        feature = options['feature']
        test_email = options.get('email')

        self.stdout.write(
            self.style.SUCCESS('🧪 Testing New Email Notification Features')
        )

        if feature in ['new_arrival', 'all']:
            self.test_new_arrival_notifications(test_email)

        if feature in ['dealer_assignment', 'all']:
            self.test_dealer_assignment_notifications(test_email)

        if feature in ['commission_payment', 'all']:
            self.test_commission_payment_notifications(test_email)

        self.stdout.write(
            self.style.SUCCESS('✅ All email feature tests completed!')
        )

    def test_new_arrival_notifications(self, test_email=None):
        """Test new arrival email notifications"""
        self.stdout.write('\n📦 Testing New Arrival Notifications...')

        try:
            # Create a test announcement if none exists
            announcement = ShipmentAnnouncement.objects.filter(is_active=True).first()

            if not announcement:
                # Create a test announcement
                admin_user = Customer.objects.filter(is_staff=True).first()
                if not admin_user:
                    self.stdout.write(
                        self.style.ERROR('❌ No admin user found. Please create an admin user first.')
                    )
                    return

                announcement = ShipmentAnnouncement.objects.create(
                    title='Test New Arrival - Coffee Beans',
                    description='This is a test announcement for coffee beans from Ethiopia. High quality arabica beans perfect for espresso and drip coffee.',
                    origin_country='Ethiopia',
                    shipment_date=timezone.now().date(),
                    estimated_arrival=(timezone.now() + timezone.timedelta(days=7)).date(),
                    product_categories='Coffee beans, Arabica',
                    is_active=True,
                    is_featured=True,
                    created_by=admin_user
                )
                self.stdout.write(f'✅ Created test announcement: {announcement.title}')

            # Test customer notifications
            if test_email:
                # Create a test customer for the provided email
                test_customer, created = Customer.objects.get_or_create(
                    email=test_email,
                    defaults={
                        'name': 'Test Customer',
                        'is_active': True,
                        'is_staff': False,
                        'is_dealer': False
                    }
                )
                if created:
                    test_customer.set_password('testpass123')
                    test_customer.save()
                    self.stdout.write(f'✅ Created test customer: {test_email}')

                # Send notification to test customer only
                subject = f"🚢 محموله جدید رسید - {announcement.title}"
                message = f"""
Test Customer عزیز،

این یک تست ایمیل برای محموله جدید است.

📦 عنوان محموله: {announcement.title}
📝 توضیحات: {announcement.description}

🔗 لینک مشاهده: http://localhost:3000/announcements/{announcement.id}

با تشکر،
تیم تست
                """.strip()

                from django.core.mail import send_mail
                send_mail(
                    subject=subject,
                    message=message,
                    from_email='test@company.com',
                    recipient_list=[test_email],
                    fail_silently=False,
                )
                self.stdout.write(f'✅ Test new arrival email sent to: {test_email}')

            else:
                # Send to all customers and dealers
                customer_count = NotificationService.notify_all_customers_new_arrival(announcement)
                dealer_count = NotificationService.notify_dealers_new_arrival(announcement)

                self.stdout.write(f'✅ New arrival notifications sent:')
                self.stdout.write(f'   - Customers: {customer_count}')
                self.stdout.write(f'   - Dealers: {dealer_count}')

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error testing new arrival notifications: {e}')
            )

    def test_dealer_assignment_notifications(self, test_email=None):
        """Test dealer assignment email notifications"""
        self.stdout.write('\n🎯 Testing Dealer Assignment Notifications...')

        try:
            # Get or create a test dealer
            if test_email:
                dealer, created = Customer.objects.get_or_create(
                    email=test_email,
                    defaults={
                        'name': 'Test Dealer',
                        'is_active': True,
                        'is_staff': False,
                        'is_dealer': True,
                        'dealer_commission_rate': Decimal('5.0')
                    }
                )
                if created:
                    dealer.set_password('testpass123')
                    dealer.save()
                    self.stdout.write(f'✅ Created test dealer: {test_email}')
            else:
                dealer = Customer.objects.filter(is_dealer=True, is_active=True).first()

            if not dealer:
                self.stdout.write(
                    self.style.ERROR('❌ No active dealer found. Please create a dealer first.')
                )
                return

            # Get or create a test order
            customer = Customer.objects.filter(is_dealer=False, is_staff=False, is_active=True).first()
            if not customer:
                customer = Customer.objects.create(
                    name='Test Customer',
                    email='testcustomer@example.com',
                    is_active=True,
                    is_staff=False,
                    is_dealer=False
                )
                customer.set_password('testpass123')
                customer.save()

            order = Order.objects.filter(
                customer=customer,
                assigned_dealer__isnull=True
            ).first()

            if not order:
                order = Order.objects.create(
                    customer=customer,
                    customer_comment='Test order for dealer assignment testing',
                    status='pending_pricing'
                )
                self.stdout.write(f'✅ Created test order: #{order.id}')

            # Test dealer assignment notification
            success = NotificationService.notify_dealer_assignment(
                order=order,
                dealer=dealer,
                custom_commission_rate=Decimal('7.5')  # Test custom rate
            )

            if success:
                self.stdout.write(f'✅ Dealer assignment notification sent to: {dealer.email}')
                self.stdout.write(f'   - Order: #{order.id}')
                self.stdout.write(f'   - Dealer: {dealer.name}')
                self.stdout.write(f'   - Commission Rate: 7.5% (custom)')
            else:
                self.stdout.write(
                    self.style.ERROR('❌ Failed to send dealer assignment notification')
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error testing dealer assignment notifications: {e}')
            )

    def test_commission_payment_notifications(self, test_email=None):
        """Test commission payment email notifications"""
        self.stdout.write('\n💰 Testing Commission Payment Notifications...')

        try:
            # Get or create a test dealer
            if test_email:
                dealer, created = Customer.objects.get_or_create(
                    email=test_email,
                    defaults={
                        'name': 'Test Dealer',
                        'is_active': True,
                        'is_staff': False,
                        'is_dealer': True,
                        'dealer_commission_rate': Decimal('5.0')
                    }
                )
                if created:
                    dealer.set_password('testpass123')
                    dealer.save()
            else:
                dealer = Customer.objects.filter(is_dealer=True, is_active=True).first()

            if not dealer:
                self.stdout.write(
                    self.style.ERROR('❌ No active dealer found. Please create a dealer first.')
                )
                return

            # Create test commissions if none exist
            commissions = DealerCommission.objects.filter(dealer=dealer, is_paid=False)

            if not commissions.exists():
                # Create test order and commission
                customer = Customer.objects.filter(is_dealer=False, is_staff=False, is_active=True).first()
                if not customer:
                    customer = Customer.objects.create(
                        name='Test Customer',
                        email='testcustomer@example.com',
                        is_active=True
                    )
                    customer.set_password('testpass123')
                    customer.save()

                order = Order.objects.create(
                    customer=customer,
                    assigned_dealer=dealer,
                    status='completed',
                    quoted_total=Decimal('1000000'),  # 1,000,000 Rial
                    completion_date=timezone.now()
                )

                commission = DealerCommission.objects.create(
                    dealer=dealer,
                    order=order,
                    commission_rate=dealer.dealer_commission_rate,
                    commission_amount=Decimal('50000'),  # 50,000 Rial (5%)
                    order_total=order.quoted_total,
                    is_paid=False
                )

                commissions = [commission]
                self.stdout.write(f'✅ Created test commission: {commission.commission_amount} Rial')

            # Test commission payment notification
            success = NotificationService.notify_dealer_commission_paid(
                dealer=dealer,
                commissions_list=commissions,
                payment_reference='TEST-PAY-2024-001'
            )

            if success:
                total_amount = sum(c.commission_amount for c in commissions)
                self.stdout.write(f'✅ Commission payment notification sent to: {dealer.email}')
                self.stdout.write(f'   - Total Amount: {total_amount:,.0f} Rial')
                self.stdout.write(f'   - Commissions Count: {len(commissions)}')
                self.stdout.write(f'   - Payment Reference: TEST-PAY-2024-001')
            else:
                self.stdout.write(
                    self.style.ERROR('❌ Failed to send commission payment notification')
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'❌ Error testing commission payment notifications: {e}')
            )