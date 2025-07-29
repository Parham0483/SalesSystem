# tasks/views/profile.py - User Profile Management Views

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.contrib.auth.hashers import check_password
from django.utils import timezone
from django.core.cache import cache
from django.db.models import Sum, Count, Q
from datetime import timedelta
import random
import string

from mysite import settings
from ..models import Customer, Order, DealerCommission, SMSNotification, EmailNotification
from ..serializers.customers import CustomerSerializer
from ..services.notification_service import NotificationService
import logging

logger = logging.getLogger(__name__)


class UserProfileViewSet(viewsets.ViewSet):
    """User Profile Management ViewSet"""
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['GET'], url_path='me')
    def get_profile(self, request):
        """Get current user's profile information"""
        user = request.user

        try:
            # Basic user info
            profile_data = {
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'phone': user.phone,
                'company_name': user.company_name,
                'is_dealer': user.is_dealer,
                'is_staff': user.is_staff,
                'date_joined': user.date_joined,
                'last_login': user.last_login,
            }

            # Add dealer-specific info
            if user.is_dealer:
                profile_data.update({
                    'dealer_code': user.dealer_code,
                    'dealer_commission_rate': float(user.dealer_commission_rate),
                })

            # Calculate user statistics
            stats = self._calculate_user_stats(user)
            profile_data['statistics'] = stats

            # Recent activity
            recent_activity = self._get_recent_activity(user)
            profile_data['recent_activity'] = recent_activity

            return Response({
                'profile': profile_data,
                'message': 'Profile retrieved successfully'
            })

        except Exception as e:
            logger.error(f"❌ Error retrieving profile for user {user.id}: {str(e)}")
            return Response({
                'error': 'Failed to retrieve profile'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['PUT'], url_path='update')
    def update_profile(self, request):
        """Update user profile information"""
        user = request.user

        try:
            # Fields that can be updated
            updatable_fields = ['name', 'phone', 'company_name']

            updated_fields = []
            for field in updatable_fields:
                if field in request.data:
                    old_value = getattr(user, field)
                    new_value = request.data[field]

                    if old_value != new_value:
                        setattr(user, field, new_value)
                        updated_fields.append(field)

            if updated_fields:
                user.save(update_fields=updated_fields)
                logger.info(f"✅ User {user.id} updated fields: {updated_fields}")

                return Response({
                    'message': 'Profile updated successfully',
                    'updated_fields': updated_fields,
                    'profile': {
                        'id': user.id,
                        'name': user.name,
                        'email': user.email,
                        'phone': user.phone,
                        'company_name': user.company_name,
                    }
                })
            else:
                return Response({
                    'message': 'No changes detected',
                    'profile': {
                        'id': user.id,
                        'name': user.name,
                        'email': user.email,
                        'phone': user.phone,
                        'company_name': user.company_name,
                    }
                })

        except Exception as e:
            logger.error(f"❌ Error updating profile for user {user.id}: {str(e)}")
            return Response({
                'error': 'Failed to update profile'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['POST'], url_path='change-password')
    def change_password(self, request):
        """Change user password with current password verification"""
        user = request.user

        try:
            current_password = request.data.get('current_password')
            new_password = request.data.get('new_password')
            confirm_password = request.data.get('confirm_password')

            # Validation
            if not all([current_password, new_password, confirm_password]):
                return Response({
                    'error': 'All password fields are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Verify current password
            if not check_password(current_password, user.password):
                return Response({
                    'error': 'Current password is incorrect'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check new password confirmation
            if new_password != confirm_password:
                return Response({
                    'error': 'New passwords do not match'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate password strength
            if len(new_password) < 8:
                return Response({
                    'error': 'Password must be at least 8 characters long'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check password contains letter and number
            if not any(c.isalpha() for c in new_password):
                return Response({
                    'error': 'Password must contain at least one letter'
                }, status=status.HTTP_400_BAD_REQUEST)

            if not any(c.isdigit() for c in new_password):
                return Response({
                    'error': 'Password must contain at least one number'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Update password
            user.set_password(new_password)
            user.save()

            # Send notification email
            try:
                self._send_password_change_notification(user)
            except Exception as e:
                logger.warning(f"⚠️ Failed to send password change notification: {str(e)}")

            logger.info(f"✅ Password changed successfully for user {user.id}")

            return Response({
                'message': 'Password changed successfully'
            })

        except Exception as e:
            logger.error(f"❌ Error changing password for user {user.id}: {str(e)}")
            return Response({
                'error': 'Failed to change password'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['GET'], url_path='orders-summary')
    def orders_summary(self, request):
        """Get user's orders summary"""
        user = request.user

        try:
            if user.is_dealer:
                # Dealer sees assigned orders
                orders = Order.objects.filter(assigned_dealer=user)
            else:
                # Regular customer sees their orders
                orders = Order.objects.filter(customer=user)

            # Calculate summary
            summary = {
                'total_orders': orders.count(),
                'pending_orders': orders.filter(status='pending_pricing').count(),
                'waiting_approval': orders.filter(status='waiting_customer_approval').count(),
                'confirmed_orders': orders.filter(status='confirmed').count(),
                'completed_orders': orders.filter(status='completed').count(),
                'rejected_orders': orders.filter(status='rejected').count(),
            }

            # Add financial info for customers
            if not user.is_dealer:
                completed_orders = orders.filter(status='completed')
                total_spent = completed_orders.aggregate(
                    total=Sum('quoted_total')
                )['total'] or 0
                summary['total_spent'] = float(total_spent)
                summary['average_order_value'] = float(
                    total_spent / completed_orders.count()) if completed_orders.count() > 0 else 0

            # Add commission info for dealers
            if user.is_dealer:
                commissions = DealerCommission.objects.filter(dealer=user)
                total_commission = commissions.aggregate(
                    total=Sum('commission_amount')
                )['total'] or 0
                paid_commission = commissions.filter(is_paid=True).aggregate(
                    total=Sum('commission_amount')
                )['total'] or 0

                summary.update({
                    'commission_rate': float(user.dealer_commission_rate),
                    'total_commission_earned': float(total_commission),
                    'paid_commission': float(paid_commission),
                    'pending_commission': float(total_commission - paid_commission),
                })

            # Recent orders
            recent_orders = orders.order_by('-created_at')[:5]
            recent_orders_data = []

            for order in recent_orders:
                recent_orders_data.append({
                    'id': order.id,
                    'status': order.status,
                    'created_at': order.created_at,
                    'total': float(order.quoted_total) if order.quoted_total else 0,
                    'items_count': order.items.count(),
                })

            return Response({
                'summary': summary,
                'recent_orders': recent_orders_data
            })

        except Exception as e:
            logger.error(f"❌ Error getting orders summary for user {user.id}: {str(e)}")
            return Response({
                'error': 'Failed to retrieve orders summary'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['GET'], url_path='notifications-history')
    def notifications_history(self, request):
        """Get user's notification history"""
        user = request.user

        try:
            # Get email notifications
            email_notifications = EmailNotification.objects.filter(
                Q(order__customer=user) |
                Q(recipient_email=user.email)
            ).order_by('-sent_at')[:20]

            # Get SMS notifications
            sms_notifications = SMSNotification.objects.filter(
                Q(order__customer=user) |
                Q(recipient_phone__contains=user.phone[-10:] if user.phone else '')
            ).order_by('-sent_at')[:20]

            # Format email notifications
            email_data = []
            for notif in email_notifications:
                email_data.append({
                    'id': notif.id,
                    'type': 'email',
                    'email_type': notif.email_type,
                    'subject': notif.subject,
                    'sent_at': notif.sent_at,
                    'is_successful': notif.is_successful,
                    'order_id': notif.order.id if notif.order else None,
                })

            # Format SMS notifications
            sms_data = []
            for notif in sms_notifications:
                sms_data.append({
                    'id': notif.id,
                    'type': 'sms',
                    'sms_type': notif.sms_type,
                    'message': notif.message[:50] + '...' if len(notif.message) > 50 else notif.message,
                    'sent_at': notif.sent_at,
                    'is_successful': notif.is_successful,
                    'order_id': notif.order.id if notif.order else None,
                })

            return Response({
                'email_notifications': email_data,
                'sms_notifications': sms_data,
                'total_notifications': len(email_data) + len(sms_data)
            })

        except Exception as e:
            logger.error(f"❌ Error getting notifications history for user {user.id}: {str(e)}")
            return Response({
                'error': 'Failed to retrieve notifications history'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _calculate_user_stats(self, user):
        """Calculate user statistics"""
        try:
            if user.is_dealer:
                # Dealer stats
                assigned_orders = Order.objects.filter(assigned_dealer=user)
                completed_orders = assigned_orders.filter(status='completed')

                return {
                    'total_assigned_orders': assigned_orders.count(),
                    'completed_orders': completed_orders.count(),
                    'success_rate': round((
                                                      completed_orders.count() / assigned_orders.count() * 100) if assigned_orders.count() > 0 else 0,
                                          2),
                    'total_commission': float(sum(order.dealer_commission_amount for order in completed_orders)),
                    'average_order_value': float(completed_orders.aggregate(avg=Sum('quoted_total'))['avg'] or 0),
                }
            else:
                # Customer stats
                orders = Order.objects.filter(customer=user)
                completed_orders = orders.filter(status='completed')

                return {
                    'total_orders': orders.count(),
                    'completed_orders': completed_orders.count(),
                    'total_spent': float(completed_orders.aggregate(total=Sum('quoted_total'))['total'] or 0),
                    'average_order_value': float(completed_orders.aggregate(avg=Sum('quoted_total'))['avg'] or 0),
                    'orders_this_month': orders.filter(created_at__gte=timezone.now() - timedelta(days=30)).count(),
                }

        except Exception as e:
            logger.error(f"❌ Error calculating stats for user {user.id}: {str(e)}")
            return {}

    def _get_recent_activity(self, user):
        """Get user's recent activity"""
        try:
            activities = []

            # Recent orders
            recent_orders = Order.objects.filter(
                Q(customer=user) | Q(assigned_dealer=user)
            ).order_by('-created_at')[:5]

            for order in recent_orders:
                activities.append({
                    'type': 'order',
                    'description': f'Order #{order.id} - {order.get_status_display()}',
                    'date': order.created_at,
                    'order_id': order.id,
                })

            # Sort by date
            activities.sort(key=lambda x: x['date'], reverse=True)

            return activities[:10]

        except Exception as e:
            logger.error(f"❌ Error getting recent activity for user {user.id}: {str(e)}")
            return []

    def _send_password_change_notification(self, user):
        """Send password change notification"""
        try:
            # Send email notification
            subject = "تغییر رمز عبور - کیان تجارت پویا کویر"
            message = f"""
{user.name} عزیز،

رمز عبور حساب کاربری شما با موفقیت تغییر یافت.

زمان تغییر: {timezone.now().strftime('%Y/%m/%d %H:%M')}

اگر این تغییر توسط شما انجام نشده، فوراً با پشتیبانی تماس بگیرید.

با احترام،
تیم کیان تجارت پویا کویر
            """.strip()

            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )

            # Send SMS notification if phone available
            if user.phone:
                sms_message = f"""سلام {user.name}
رمز عبور حساب شما تغییر یافت.
زمان: {timezone.now().strftime('%H:%M')}
اگر توسط شما نبوده، تماس بگیرید.
کیان تجارت پویا کویر"""

                NotificationService.send_sms_notification(
                    phone=user.phone,
                    message=sms_message,
                    sms_type='password_changed'
                )

        except Exception as e:
            logger.error(f"❌ Failed to send password change notification: {str(e)}")


# Password Reset Views (using OTP)

@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """Request password reset via email/SMS OTP"""
    try:
        email = request.data.get('email')

        if not email:
            return Response({
                'error': 'Email is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if user exists
        try:
            user = Customer.objects.get(email=email, is_active=True)
        except Customer.DoesNotExist:
            # Don't reveal if email exists or not for security
            return Response({
                'message': 'If an account with this email exists, you will receive reset instructions.'
            })

        # Generate OTP
        otp = ''.join(random.choices(string.digits, k=6))

        # Store OTP in cache (expires in 10 minutes)
        cache_key = f"password_reset_otp_{user.id}"
        cache.set(cache_key, {
            'otp': otp,
            'user_id': user.id,
            'created_at': timezone.now().isoformat()
        }, timeout=600)  # 10 minutes

        # Send OTP via email
        subject = "بازیابی رمز عبور - کیان تجارت پویا کویر"
        message = f"""
{user.name} عزیز،

کد بازیابی رمز عبور شما: {otp}

این کد تا 10 دقیقه معتبر است.

اگر درخواست بازیابی رمز عبور نداده‌اید، این پیام را نادیده بگیرید.

با احترام،
تیم کیان تجارت پویا کویر
        """.strip()

        from django.core.mail import send_mail
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        # Send SMS if phone available
        if user.phone:
            sms_message = f"""کد بازیابی رمز عبور: {otp}
این کد تا 10 دقیقه معتبر است.
کیان تجارت پویا کویر"""

            NotificationService.send_sms_notification(
                phone=user.phone,
                message=sms_message,
                sms_type='password_reset_otp'
            )

        logger.info(f"✅ Password reset OTP sent to user {user.id}")

        return Response({
            'message': 'Reset code sent to your email and phone (if available)',
            'email_sent': True,
            'sms_sent': bool(user.phone)
        })

    except Exception as e:
        logger.error(f"❌ Error requesting password reset: {str(e)}")
        return Response({
            'error': 'Failed to process password reset request'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_reset_otp(request):
    """Verify OTP for password reset"""
    try:
        email = request.data.get('email')
        otp = request.data.get('otp')

        if not email or not otp:
            return Response({
                'error': 'Email and OTP are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get user
        try:
            user = Customer.objects.get(email=email, is_active=True)
        except Customer.DoesNotExist:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check OTP
        cache_key = f"password_reset_otp_{user.id}"
        cached_data = cache.get(cache_key)

        if not cached_data or cached_data['otp'] != otp:
            return Response({
                'error': 'Invalid or expired OTP'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Generate reset token
        reset_token = ''.join(random.choices(string.ascii_letters + string.digits, k=32))

        # Store reset token (expires in 30 minutes)
        reset_cache_key = f"password_reset_token_{user.id}"
        cache.set(reset_cache_key, {
            'token': reset_token,
            'user_id': user.id,
            'verified_at': timezone.now().isoformat()
        }, timeout=1800)  # 30 minutes

        # Clear OTP
        cache.delete(cache_key)

        logger.info(f"✅ Password reset OTP verified for user {user.id}")

        return Response({
            'message': 'OTP verified successfully',
            'reset_token': reset_token
        })

    except Exception as e:
        logger.error(f"❌ Error verifying reset OTP: {str(e)}")
        return Response({
            'error': 'Failed to verify OTP'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """Reset password with verified token"""
    try:
        email = request.data.get('email')
        reset_token = request.data.get('reset_token')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not all([email, reset_token, new_password, confirm_password]):
            return Response({
                'error': 'All fields are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check password confirmation
        if new_password != confirm_password:
            return Response({
                'error': 'Passwords do not match'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate password strength
        if len(new_password) < 8:
            return Response({
                'error': 'Password must be at least 8 characters long'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get user
        try:
            user = Customer.objects.get(email=email, is_active=True)
        except Customer.DoesNotExist:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check reset token
        reset_cache_key = f"password_reset_token_{user.id}"
        cached_data = cache.get(reset_cache_key)

        if not cached_data or cached_data['token'] != reset_token:
            return Response({
                'error': 'Invalid or expired reset token'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update password
        user.set_password(new_password)
        user.save()

        # Clear reset token
        cache.delete(reset_cache_key)

        # Send confirmation
        try:
            subject = "رمز عبور با موفقیت تغییر یافت"
            message = f"""
{user.name} عزیز،

رمز عبور حساب کاربری شما با موفقیت تغییر یافت.

زمان تغییر: {timezone.now().strftime('%Y/%m/%d %H:%M')}

اکنون می‌توانید با رمز عبور جدید وارد حساب خود شوید.

با احترام،
تیم کیان تجارت پویا کویر
            """.strip()

            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )

        except Exception as e:
            logger.warning(f"⚠️ Failed to send password reset confirmation: {str(e)}")

        logger.info(f"✅ Password reset completed for user {user.id}")

        return Response({
            'message': 'Password reset successfully'
        })

    except Exception as e:
        logger.error(f"❌ Error resetting password: {str(e)}")
        return Response({
            'error': 'Failed to reset password'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)