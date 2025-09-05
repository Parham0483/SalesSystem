# debug_order_email.py - Check why order creation doesn't trigger emails

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings')
django.setup()

from tasks.models import Order, EmailNotification
from tasks.services.notification_service import NotificationService


def check_recent_orders():
    """Check recent orders and their email notifications"""

    print("Checking Recent Orders and Email Notifications")
    print("=" * 50)

    # Get the most recent orders
    recent_orders = Order.objects.all().order_by('-created_at')[:5]

    if not recent_orders:
        print("No orders found in the database")
        return

    for order in recent_orders:
        print(f"\nOrder #{order.id}:")
        print(f"  Customer: {order.customer.name}")
        print(f"  Email: {order.customer.email}")
        print(f"  Created: {order.created_at}")
        print(f"  Status: {order.status}")

        # Check if email notifications were sent for this order
        notifications = EmailNotification.objects.filter(order=order)

        if notifications.exists():
            print(f"  Email notifications sent: {notifications.count()}")
            for notif in notifications:
                print(f"    - Type: {notif.email_type}, Success: {notif.is_successful}")
                if not notif.is_successful and notif.error_message:
                    print(f"      Error: {notif.error_message}")
        else:
            print("  NO EMAIL NOTIFICATIONS FOUND!")
            print("  This indicates the notification wasn't triggered when the order was created.")


def check_order_creation_flow():
    """Check where order creation should trigger notifications"""

    print("\nChecking Order Creation Flow")
    print("=" * 30)

    # This will help identify where the notification should be called
    print("The email notification should be triggered in one of these places:")
    print("1. Order model's save() method")
    print("2. Order creation view/serializer")
    print("3. Signal handler for Order creation")
    print("4. Manual call in the order creation endpoint")

    print("\nLet's check the most recent order to see if we can manually trigger the notification:")

    recent_order = Order.objects.order_by('-created_at').first()
    if recent_order:
        print(f"Most recent order: #{recent_order.id}")
        print(f"Customer: {recent_order.customer.name}")

        # Try to manually send the notification
        try:
            print("\nManually triggering admin notification...")
            result = NotificationService.notify_admin_new_order(recent_order)

            if result:
                print("SUCCESS: Admin notification sent manually!")
                print("This means the notification system works, but it's not being called automatically.")
            else:
                print("FAILED: Could not send admin notification manually.")
                print("This indicates an issue with the notification system itself.")

        except Exception as e:
            print(f"ERROR: Exception when trying to send notification: {e}")

    else:
        print("No orders found to test with.")


def check_notification_settings():
    """Check if notification settings are correct"""

    print("\nChecking Notification Settings")
    print("=" * 30)

    from django.conf import settings

    print(f"Email Backend: {getattr(settings, 'EMAIL_BACKEND', 'Not set')}")
    print(f"Default From Email: {getattr(settings, 'DEFAULT_FROM_EMAIL', 'Not set')}")
    print(f"Admin Email List: {getattr(settings, 'ADMIN_EMAIL_LIST', 'Not set')}")
    print(f"Debug Mode: {getattr(settings, 'DEBUG', False)}")

    # Check if SMTP settings are present
    smtp_settings = [
        'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_HOST_USER', 'EMAIL_HOST_PASSWORD'
    ]

    print("\nSMTP Settings:")
    for setting in smtp_settings:
        value = getattr(settings, setting, 'Not set')
        # Hide password for security
        if 'PASSWORD' in setting and value != 'Not set':
            value = '*' * len(str(value))
        print(f"  {setting}: {value}")


def find_order_creation_code():
    """Help identify where order creation happens"""

    print("\nFinding Order Creation Code")
    print("=" * 27)

    print("To fix the missing email notifications, you need to add this code")
    print("to wherever orders are created in your Django application:")
    print()
    print("# Add this after order creation:")
    print("from tasks.services.notification_service import NotificationService")
    print("NotificationService.notify_admin_new_order(order)")
    print()
    print("Common places to add this:")
    print("1. In your Order creation API view")
    print("2. In the Order model's save() method")
    print("3. In a Django signal handler")
    print()
    print("Example for API view:")
    print("```python")
    print("# In your order creation view")
    print("order = Order.objects.create(...)")
    print("# Add this line:")
    print("NotificationService.notify_admin_new_order(order)")
    print("```")


if __name__ == "__main__":
    check_recent_orders()
    check_order_creation_flow()
    check_notification_settings()
    find_order_creation_code()