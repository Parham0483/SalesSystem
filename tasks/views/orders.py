# tasks/views/orders.py - COMPLETE INTEGRATION WITH SMS
import mimetypes
import os

from django.db.models import Sum, Q
from rest_framework import viewsets, status, request
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone
import logging
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes

from mysite import settings
from ..models import OrderPaymentReceipt, Invoice  # Import the receipt model

from ..serializers import (
    OrderCreateSerializer,
    OrderAdminUpdateSerializer,
    OrderDetailSerializer,
    OrderItemSerializer,
)
from ..serializers.dealers import (
    DealerSerializer, DealerAssignmentSerializer,
    DealerNotesUpdateSerializer
)
from ..models import Order, OrderItem, Customer, OrderLog
from ..services.notification_service import NotificationService
from ..services.enhanced_persian_pdf import EnhancedPersianInvoicePDFGenerator
from ..services.unofficial_invoice_pdf import UnofficialInvoicePDFGenerator
from ..services.pre_invoice_pdf import PreInvoicePDFGenerator

logger = logging.getLogger(__name__)


class OrderViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Allow dealers to access their assigned orders"""
        user = self.request.user

        if user.is_staff:
            # Admin can see all orders
            return Order.objects.all().order_by('-created_at')
        elif user.is_dealer:
            # Dealers can see both their customer orders AND assigned orders
            return Order.objects.filter(
                Q(customer=user) | Q(assigned_dealer=user)
            ).distinct().order_by('-created_at')
        else:
            # Regular customers see only their orders
            return Order.objects.filter(customer=user).order_by('-created_at')

    def get_serializer_class(self):
        user = self.request.user
        if user.is_staff:
            if self.action in ['update', 'partial_update', 'submit_pricing']:
                return OrderAdminUpdateSerializer
            if self.action in ['retrieve', 'list']:
                return OrderDetailSerializer
        else:
            if self.action == 'create':
                return OrderCreateSerializer
            if self.action in ['retrieve', 'list']:
                return OrderDetailSerializer
        return OrderDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        """Custom retrieve method with better error handling"""
        try:
            order = self.get_object()
            serializer = self.get_serializer(order)

            logger.info(
                f"🔍 Order {order.id} accessed by {request.user.name} (Staff: {request.user.is_staff}, Dealer: {request.user.is_dealer})")

            return Response(serializer.data)
        except Exception as e:
            logger.error(f"❌ Error retrieving order: {str(e)}")
            return Response({
                'error': f'Order not found or access denied: {str(e)}'
            }, status=status.HTTP_404_NOT_FOUND)

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                order = serializer.save()

                logger.info(
                    f"📋 Order #{order.id} created - Business Invoice Type: {order.get_business_invoice_type_display()}")

                email_sent = False
                sms_sent = False

                # 1. Send admin email notification
                try:
                    email_sent = NotificationService.notify_admin_new_order(order)
                    logger.info(f"📧 Admin email sent: {email_sent}")
                except Exception as e:
                    logger.error(f"❌ Admin email failed: {str(e)}")

                # 2. Send customer SMS notification (SINGLE CALL)
                try:
                    if order.customer.phone:
                        invoice_type_persian = "رسمی" if order.business_invoice_type == 'official' else "بدون مالیات"
                        customer_sms = f"""سلام {order.customer.name}
                سفارش #{order.id} با موفقیت ثبت شد.
                نوع فاکتور: {invoice_type_persian}
                منتظر قیمت‌گذاری باشید.

                شرکت تجاری پارسیان"""

                        # Use the correct method name - it might be send_sms_notification instead
                        sms_sent = NotificationService.send_sms_notification(
                            phone=order.customer.phone,
                            message=customer_sms,
                            order=order,
                            sms_type='order_submitted'
                        )
                        logger.info(f"📱 Customer SMS sent: {sms_sent}")
                except Exception as e:
                    logger.error(f"❌ Customer SMS failed: {str(e)}")
                    sms_sent = False

                    # Return response with business invoice type info
                response_data = serializer.data
                response_data.update({
                    'notifications': {
                        'admin_email_sent': email_sent,
                        'customer_sms_sent': sms_sent
                    },
                    'message': f'Order created successfully with {order.get_business_invoice_type_display()}'
                })

                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"❌ Order creation failed: {str(e)}")
            return Response({'error': f'Order creation failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['POST'], url_path='submit_pricing')
    def submit_pricing(self, request, *args, **kwargs):
        """ENHANCED: Admin submits pricing with dual notification"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            order = self.get_object()

            if order.status != 'pending_pricing':
                return Response({
                    'error': f'Cannot price order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            serializer = OrderAdminUpdateSerializer(
                order,
                data=request.data,
                context={'request': request}
            )

            if serializer.is_valid():
                updated_order = serializer.save()

                # Send dual notification (email + SMS)
                dual_result = NotificationService.send_dual_notification(
                    order=updated_order,
                    notification_type='pricing_ready'
                )

                return Response({
                    'message': 'Pricing submitted successfully',
                    'order': OrderDetailSerializer(updated_order).data,
                    'notifications': {
                        'email_sent': dual_result['email']['sent'],
                        'sms_sent': dual_result['sms']['sent'],
                        'email_error': dual_result['email'].get('error'),
                        'sms_error': dual_result['sms'].get('error')
                    }
                }, status=status.HTTP_200_OK)

            return Response({
                'error': 'Invalid pricing data',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.error(f"❌ Pricing submission failed: {str(e)}")
            return Response({
                'error': f'Pricing submission failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['POST'], url_path='approve')
    def approve_order(self, request, *args, **kwargs):
        """ENHANCED: Customer approves order with pre-invoice generation"""
        try:
            order = self.get_object()

            if order.customer != request.user:
                return Response({
                    'error': 'Permission denied'
                }, status=status.HTTP_403_FORBIDDEN)

            if order.status != 'waiting_customer_approval':
                return Response({
                    'error': f'Cannot approve order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Approve order and create pre-invoice
            order.customer_approve()

            # Send dual notification (email + SMS)
            dual_result = NotificationService.send_dual_notification(
                order=order,
                notification_type='order_confirmed'
            )

            # Notify admin
            NotificationService.notify_admin_order_status_change(order, 'confirmed', request.user)

            return Response({
                'message': 'Order approved successfully and pre-invoice generated',
                'order': OrderDetailSerializer(order).data,
                'invoice_created': order.has_pre_invoice,
                'invoice_id': order.invoice.id if hasattr(order, 'invoice') else None,
                'notifications': {
                    'email_sent': dual_result['email']['sent'],
                    'sms_sent': dual_result['sms']['sent'],
                    'email_error': dual_result['email'].get('error'),
                    'sms_error': dual_result['sms'].get('error')
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"❌ Order approval failed: {str(e)}")
            return Response({
                'error': f'Order approval failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['POST'], url_path='reject')
    def reject_order(self, request, *args, **kwargs):
        """ENHANCED: Customer rejects order with dual notification"""
        try:
            order = self.get_object()

            if order.customer != request.user:
                return Response({
                    'error': 'Permission denied'
                }, status=status.HTTP_403_FORBIDDEN)

            if order.status != 'waiting_customer_approval':
                return Response({
                    'error': f'Cannot reject order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            rejection_reason = request.data.get('rejection_reason', '')
            if not rejection_reason:
                return Response({
                    'error': 'Rejection reason is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            order.customer_reject(rejection_reason)

            # Send dual notification (email + SMS)
            dual_result = NotificationService.send_dual_notification(
                order=order,
                notification_type='order_rejected'
            )

            # Notify admin
            NotificationService.notify_admin_order_status_change(order, 'rejected', request.user)

            return Response({
                'message': 'Order rejected successfully',
                'order': OrderDetailSerializer(order).data,
                'notifications': {
                    'email_sent': dual_result['email']['sent'],
                    'sms_sent': dual_result['sms']['sent'],
                    'email_error': dual_result['email'].get('error'),
                    'sms_error': dual_result['sms'].get('error')
                }
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"❌ Order rejection failed: {str(e)}")
            return Response({
                'error': f'Order rejection failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['POST'], url_path='complete')
    def complete_order(self, request, *args, **kwargs):
        """ENHANCED: Admin completes order with SMS notification"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            order = self.get_object()

            if order.status != 'confirmed':
                return Response({
                    'error': f'Cannot complete order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            completed_order, invoice = order.mark_as_completed(request.user)

            # Create dealer commission if applicable
            commission_created = False
            if order.assigned_dealer and order.dealer_commission_amount > 0:
                from ..models import DealerCommission
                commission = DealerCommission.create_for_completed_order(order)
                if commission:
                    commission_created = True
                    logger.info(
                        f"💰 Commission created for dealer {order.assigned_dealer.name}: {commission.commission_amount}")

            # REPLACE the basic SMS with full completion notification
            completion_notification_sent = NotificationService.notify_customer_order_completed(
                order=completed_order,
                include_invoice=True
            )

            return Response({
                'message': 'Order completed successfully',
                'order': OrderDetailSerializer(completed_order).data,
                'invoice_id': invoice.id,
                'commission_created': commission_created,
                'completion_notification_sent': completion_notification_sent  # Updated response
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"❌ Order completion failed: {str(e)}")
            return Response({
                'error': f'Order completion failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['POST'], url_path='assign-dealer')
    def assign_dealer(self, request, *args, **kwargs):
        """ENHANCED: Admin assigns dealer with email + SMS notifications"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()
        serializer = DealerAssignmentSerializer(data=request.data, context={'order': order})

        if serializer.is_valid():
            dealer_id = serializer.validated_data['dealer_id']
            dealer_notes = serializer.validated_data.get('dealer_notes', '')
            custom_commission_rate = serializer.validated_data.get('custom_commission_rate')

            try:
                dealer = Customer.objects.get(id=dealer_id, is_dealer=True, is_active=True)

                # Determine effective commission rate
                if custom_commission_rate is not None:
                    effective_rate = custom_commission_rate
                else:
                    effective_rate = dealer.dealer_commission_rate
                    if effective_rate <= 0:
                        return Response({
                            'error': f'Dealer {dealer.name} has no default commission rate set. Please provide a custom commission rate.'
                        }, status=status.HTTP_400_BAD_REQUEST)

                # Assign dealer
                success = order.assign_dealer(dealer, request.user, custom_commission_rate)

                if success:
                    if dealer_notes:
                        order.dealer_notes = dealer_notes
                        order.save()

                    # Send email notification to dealer
                    email_sent = NotificationService.notify_dealer_assignment(
                        order=order,
                        dealer=dealer,
                        custom_commission_rate=custom_commission_rate
                    )

                    # NEW: Send SMS notification to dealer
                    sms_sent = False
                    if dealer.phone:
                        dealer_sms = f"""سلام {dealer.name}
سفارش #{order.id} به شما تخصیص داده شد.
مشتری: {order.customer.name}
کمیسیون: {effective_rate}%
وارد پنل شوید.
کیان تجارت پویا کویر"""

                        sms_sent = NotificationService.send_sms_notification(
                            phone=dealer.phone,
                            message=dealer_sms,
                            order=order,
                            sms_type='dealer_assigned',
                            dealer=dealer
                        )

                    logger.info(
                        f"✅ Dealer {dealer.name} assigned to Order #{order.id} with {effective_rate}% commission")
                    if email_sent:
                        logger.info(f"📧 Assignment notification email sent to {dealer.email}")
                    if sms_sent:
                        logger.info(f"📱 Assignment notification SMS sent to {dealer.phone}")

                    return Response({
                        'message': f'Dealer {dealer.name} assigned successfully with {effective_rate}% commission',
                        'order': OrderDetailSerializer(order).data,
                        'dealer_info': {
                            'name': dealer.name,
                            'email': dealer.email,
                            'phone': dealer.phone,
                            'commission_rate': float(effective_rate),
                            'dealer_code': dealer.dealer_code,
                            'is_custom_rate': custom_commission_rate is not None
                        },
                        'notifications': {
                            'email_sent': email_sent,
                            'sms_sent': sms_sent
                        }
                    }, status=status.HTTP_200_OK)
                else:
                    return Response({
                        'error': 'Failed to assign dealer'
                    }, status=status.HTTP_400_BAD_REQUEST)

            except Customer.DoesNotExist:
                return Response({
                    'error': 'Dealer not found'
                }, status=status.HTTP_404_NOT_FOUND)
            except Exception as e:
                logger.error(f"❌ Error assigning dealer: {str(e)}")
                return Response({
                    'error': f'Error assigning dealer: {str(e)}'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'error': 'Invalid data',
            'details': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['POST'], url_path='remove-dealer')
    def remove_dealer(self, request, *args, **kwargs):
        """ENHANCED: Admin removes dealer with email + SMS notifications"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()
        removal_reason = request.data.get('reason', '')

        # Store dealer info before removal for notifications
        old_dealer = order.assigned_dealer

        success = order.remove_dealer(request.user)

        if success and old_dealer:
            # Send email notification to removed dealer
            email_sent = NotificationService.notify_dealer_removal(
                order=order,
                dealer=old_dealer,
                removed_by=request.user,
                reason=removal_reason
            )

            # NEW: Send SMS notification to removed dealer
            sms_sent = False
            if old_dealer.phone:
                removal_sms = f"""سلام {old_dealer.name}
سفارش #{order.id} از شما حذف شد.
{f'دلیل: {removal_reason}' if removal_reason else ''}
کیان تجارت پویا کویر"""

                sms_sent = NotificationService.send_sms_notification(
                    phone=old_dealer.phone,
                    message=removal_sms,
                    order=order,
                    sms_type='dealer_removed',
                    dealer=old_dealer
                )

            logger.info(f"✅ Dealer {old_dealer.name} removed from Order #{order.id}")
            if email_sent:
                logger.info(f"📧 Removal notification email sent to {old_dealer.email}")
            if sms_sent:
                logger.info(f"📱 Removal notification SMS sent to {old_dealer.phone}")

            return Response({
                'message': f'Dealer {old_dealer.name} removed successfully',
                'order': OrderDetailSerializer(order).data,
                'removed_dealer': {
                    'name': old_dealer.name,
                    'email': old_dealer.email,
                    'phone': old_dealer.phone,
                    'dealer_code': old_dealer.dealer_code
                },
                'notifications': {
                    'email_sent': email_sent,
                    'sms_sent': sms_sent
                }
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'message': 'No dealer was assigned to this order',
                'order': OrderDetailSerializer(order).data,
                'notifications': {
                    'email_sent': False,
                    'sms_sent': False
                }
            }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['POST'], url_path='update-dealer-notes')
    def update_dealer_notes(self, request, *args, **kwargs):
        """Update dealer notes"""
        order = self.get_object()

        if not (request.user.is_staff or request.user == order.assigned_dealer):
            return Response({
                'error': 'Permission denied. Only admin or assigned dealer can update notes.'
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = DealerNotesUpdateSerializer(data=request.data)

        if serializer.is_valid():
            dealer_notes = serializer.validated_data['dealer_notes']
            success = order.update_dealer_notes(dealer_notes, request.user)

            if success:
                return Response({
                    'message': 'Dealer notes updated successfully',
                    'order': OrderDetailSerializer(order).data
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'error': 'No dealer assigned to this order'
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['GET'], url_path='my-assigned-orders')
    def my_assigned_orders(self, request):
        """Get orders assigned to the current dealer"""
        if not request.user.is_dealer:
            return Response({
                'error': 'Permission denied. Dealer access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        orders = Order.objects.filter(assigned_dealer=request.user).order_by('-created_at')
        serializer = OrderDetailSerializer(orders, many=True)

        # Calculate summary stats
        total_value = orders.filter(status='completed').aggregate(
            total=Sum('quoted_total')
        )['total'] or 0

        pending_commissions = 0
        for order in orders.filter(status='completed'):
            pending_commissions += order.dealer_commission_amount

        return Response({
            'count': orders.count(),
            'orders': serializer.data,
            'summary': {
                'total_orders': orders.count(),
                'completed_orders': orders.filter(status='completed').count(),
                'pending_orders': orders.filter(status__in=[
                    'pending_pricing', 'waiting_customer_approval', 'confirmed'
                ]).count(),
                'total_value': float(total_value),
                'estimated_commission': float(pending_commissions)
            }
        })

    @action(detail=False, methods=['GET'], url_path='completed')
    def completed_orders(self, request):
        """Get completed orders"""
        if request.user.is_staff:
            orders = Order.objects.filter(status='completed').order_by('-completion_date')
        elif request.user.is_dealer:
            # Dealers see completed orders they were assigned to
            orders = Order.objects.filter(
                Q(customer=request.user, status='completed') |
                Q(assigned_dealer=request.user, status='completed')
            ).distinct().order_by('-completion_date')
        else:
            orders = Order.objects.filter(
                customer=request.user,
                status='completed'
            ).order_by('-completion_date')

        serializer = OrderDetailSerializer(orders, many=True)
        return Response({
            'count': orders.count(),
            'orders': serializer.data
        })

    @action(detail=False, methods=['GET'], url_path='pending-pricing')
    def pending_pricing(self, request):
        """Get orders pending pricing (admin only)"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        orders = Order.objects.filter(status='pending_pricing').order_by('created_at')
        serializer = OrderDetailSerializer(orders, many=True)
        return Response({
            'count': orders.count(),
            'orders': serializer.data
        })

    @action(detail=False, methods=['GET'], url_path='waiting-approval')
    def waiting_approval(self, request):
        """Get orders waiting for customer approval"""
        if request.user.is_staff:
            orders = Order.objects.filter(status='waiting_customer_approval').order_by('pricing_date')
        elif request.user.is_dealer:
            # Dealers see orders waiting approval that they're assigned to
            orders = Order.objects.filter(
                Q(customer=request.user, status='waiting_customer_approval') |
                Q(assigned_dealer=request.user, status='waiting_customer_approval')
            ).distinct().order_by('pricing_date')
        else:
            orders = Order.objects.filter(
                customer=request.user,
                status='waiting_customer_approval'
            ).order_by('pricing_date')

        serializer = OrderDetailSerializer(orders, many=True)
        return Response({
            'count': orders.count(),
            'orders': serializer.data
        })

    @action(detail=True, methods=['POST'], url_path='upload-payment-receipt')
    def upload_payment_receipt(self, request, *args, **kwargs):
        """Customer uploads multiple payment receipts (images and PDFs) - FIXED VERSION"""
        try:
            order = self.get_object()

            if order.customer != request.user:
                return Response({
                    'error': 'Permission denied'
                }, status=status.HTTP_403_FORBIDDEN)

            if order.status != 'confirmed':
                return Response({
                    'error': f'Cannot upload payment receipt for order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get multiple files
            uploaded_files = request.FILES.getlist('payment_receipts')

            if not uploaded_files:
                return Response({
                    'error': 'At least one payment receipt file is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validation constants
            allowed_image_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
            allowed_pdf_types = ['application/pdf']
            allowed_types = allowed_image_types + allowed_pdf_types

            max_file_size = 15 * 1024 * 1024  # 15MB
            max_files_count = 10

            if len(uploaded_files) > max_files_count:
                return Response({
                    'error': f'Maximum {max_files_count} files allowed per upload'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate each file
            valid_files = []
            errors = []

            for i, file in enumerate(uploaded_files):
                file_errors = []

                if file.content_type not in allowed_types:
                    file_errors.append(f'File {i + 1} ({file.name}): Unsupported format')

                if file.size > max_file_size:
                    file_errors.append(f'File {i + 1} ({file.name}): Size exceeds 15MB limit')

                if file.size == 0:
                    file_errors.append(f'File {i + 1} ({file.name}): File is empty')

                if file_errors:
                    errors.extend(file_errors)
                else:
                    # Determine file type
                    file_type = 'pdf' if file.content_type in allowed_pdf_types else 'image'
                    valid_files.append((file, file_type))

            # If there are validation errors, return them
            if errors:
                return Response({
                    'error': 'File validation failed',
                    'details': errors
                }, status=status.HTTP_400_BAD_REQUEST)

            # Save valid files with proper error handling
            saved_receipts = []
            from ..models import OrderPaymentReceipt
            import os
            from django.conf import settings

            for file, file_type in valid_files:
                try:
                    # Create the receipt record
                    receipt = OrderPaymentReceipt(
                        order=order,
                        file_type=file_type,
                        uploaded_by=request.user
                    )

                    # Save the file
                    receipt.receipt_file.save(file.name, file, save=True)

                    # Verify file was saved
                    if receipt.receipt_file and os.path.exists(receipt.receipt_file.path):
                        logger.info(f"✅ File saved successfully: {receipt.receipt_file.path}")

                        saved_receipts.append({
                            'id': receipt.id,
                            'file_name': receipt.file_name,
                            'file_type': receipt.file_type,
                            'file_size': receipt.file_size,
                            'uploaded_at': receipt.uploaded_at,
                            'file_url': request.build_absolute_uri(receipt.receipt_file.url)
                        })
                    else:
                        logger.error(f"❌ File not found after save: {file.name}")
                        receipt.delete()  # Clean up the database record
                        errors.append(f'Failed to save {file.name}: File not found after upload')

                except Exception as e:
                    logger.error(f"❌ Error saving receipt file {file.name}: {str(e)}")
                    errors.append(f'Failed to save {file.name}: {str(e)}')

            # Update order status if we have successfully saved receipts
            if saved_receipts:
                order.has_payment_receipts = True
                order.status = 'payment_uploaded'
                order.save(update_fields=['has_payment_receipts', 'status'])

                # Create log entry
                OrderLog.objects.create(
                    order=order,
                    action='payment_receipts_uploaded',
                    description=f"{len(saved_receipts)} payment receipts uploaded by {request.user.name}",
                    performed_by=request.user
                )

                # Notify admin about payment upload
                try:
                    NotificationService.notify_admin_payment_uploaded(order)
                except Exception as e:
                    logger.warning(f"Failed to send payment upload notification: {str(e)}")

            # Prepare response
            response_data = {
                'message': f'{len(saved_receipts)} payment receipts uploaded successfully',
                'uploaded_receipts': saved_receipts,
                'total_receipts': order.total_receipts_count,
                'order': OrderDetailSerializer(order).data
            }

            if errors:
                response_data['warnings'] = errors

            return Response(response_data)

        except Exception as e:
            logger.error(f"❌ Payment receipts upload failed: {str(e)}")
            return Response({
                'error': f'خطا در آپلود رسیدهای پرداخت: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    @action(detail=True, methods=['GET'], url_path='payment-receipts')
    def get_payment_receipts(self, request, *args, **kwargs):
        """Get all payment receipts for an order with DIRECT media URLs"""
        try:
            order = self.get_object()

            # Permission check
            if not (request.user.is_staff or request.user == order.customer or request.user == order.assigned_dealer):
                return Response({
                    'error': 'Permission denied'
                }, status=status.HTTP_403_FORBIDDEN)

            receipts = order.all_payment_receipts
            receipts_data = []

            for receipt in receipts:
                # Build the file URL properly
                file_url = None
                download_url = None

                if receipt.receipt_file:
                    try:
                        # Get the direct media URL
                        file_url = request.build_absolute_uri(receipt.receipt_file.url)
                        download_url = file_url
                    except (ValueError, AttributeError) as e:
                        logger.warning(f"Could not generate URL for receipt {receipt.id}: {e}")

                receipts_data.append({
                    'id': receipt.id,
                    'file_name': receipt.file_name,
                    'file_type': receipt.file_type,
                    'file_size': receipt.file_size,
                    'uploaded_at': receipt.uploaded_at,
                    'uploaded_by': receipt.uploaded_by.name,
                    'is_verified': receipt.is_verified,
                    'admin_notes': receipt.admin_notes,
                    # FIXED: Direct media URLs - no authentication needed
                    'file_url': file_url,
                    'download_url': download_url
                })

            return Response({
                'order_id': order.id,
                'total_receipts': len(receipts_data),
                'receipts': receipts_data
            })

        except Exception as e:
            logger.error(f"❌ Error getting payment receipts: {str(e)}")
            return Response({
                'error': 'Failed to retrieve payment receipts'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['DELETE'], url_path='delete-payment-receipt/(?P<receipt_id>[^/.]+)')
    def delete_payment_receipt(self, request, pk=None, receipt_id=None):
        """Delete a specific payment receipt"""
        try:
            order = self.get_object()

            # Only customer and admin can delete
            if not (request.user.is_staff or request.user == order.customer):
                return Response({
                    'error': 'Permission denied'
                }, status=status.HTTP_403_FORBIDDEN)

            # Only allow deletion if order is still in payment_uploaded status
            if order.status not in ['confirmed', 'payment_uploaded']:
                return Response({
                    'error': 'Cannot delete receipts for this order status'
                }, status=status.HTTP_400_BAD_REQUEST)

            from ..models import OrderPaymentReceipt
            try:
                receipt = OrderPaymentReceipt.objects.get(
                    id=receipt_id,
                    order=order
                )
            except OrderPaymentReceipt.DoesNotExist:
                return Response({
                    'error': 'Receipt not found'
                }, status=status.HTTP_404_NOT_FOUND)

            # Delete the file and record
            file_name = receipt.file_name
            receipt.delete()

            # Update order status if no more receipts
            if order.total_receipts_count == 0:
                order.has_payment_receipts = False
                order.status = 'confirmed'  # Back to confirmed status
                order.save(update_fields=['has_payment_receipts', 'status'])

            return Response({
                'message': f'Receipt {file_name} deleted successfully',
                'remaining_receipts': order.total_receipts_count
            })

        except Exception as e:
            logger.error(f"❌ Error deleting payment receipt: {str(e)}")
            return Response({
                'error': 'Failed to delete payment receipt'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['POST'], url_path='verify-payment')
    def verify_payment(self, request, *args, **kwargs):
        """ENHANCED: Admin verifies payment and generates final invoice"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            order = self.get_object()

            if order.status != 'payment_uploaded':
                return Response({
                    'error': f'Cannot verify payment for order with status: {order.status}'
                }, status=status.HTTP_400_BAD_REQUEST)

            payment_verified = request.data.get('payment_verified', True)
            payment_notes = request.data.get('payment_notes', '')

            if payment_verified:
                # Complete order and upgrade to final invoice
                completed_order, invoice = order.mark_as_completed(request.user)

                if payment_notes:
                    order.payment_notes = payment_notes
                    order.save(update_fields=['payment_notes'])

                # Create log
                OrderLog.objects.create(
                    order=order,
                    action='payment_verified',
                    description=f"Payment verified and final invoice generated by {request.user.name}",
                    performed_by=request.user
                )

                # FIXED: Send completion notifications with invoice
                completion_notification_sent = NotificationService.notify_customer_order_completed(
                    order=completed_order,
                    include_invoice=True
                )

                return Response({
                    'message': 'Payment verified, order completed, and final invoice generated',
                    'order': OrderDetailSerializer(completed_order).data,
                    'final_invoice_created': True,
                    'invoice_id': invoice.id if invoice else None,
                    'completion_notification_sent': completion_notification_sent  # Add this
                })

            else:
                # Reject payment - move back to confirmed status
                order.payment_verified = False
                order.payment_notes = payment_notes
                order.status = 'confirmed'
                order.save()

                OrderLog.objects.create(
                    order=order,
                    action='payment_rejected',
                    description=f"Payment receipt rejected by {request.user.name}: {payment_notes}",
                    performed_by=request.user
                )

                return Response({
                    'message': 'Payment receipt rejected',
                    'order': OrderDetailSerializer(order).data
                })

        except Exception as e:
            logger.error(f"❌ Payment verification failed: {str(e)}")
            return Response({
                'error': f'Payment verification failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



    @action(detail=False, methods=['GET'], url_path='dealer-dashboard-stats')
    def dealer_dashboard_stats(self, request):
        """Get dashboard statistics for dealer"""
        if not request.user.is_dealer:
            return Response({
                'error': 'Permission denied. Dealer access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        orders = Order.objects.filter(assigned_dealer=request.user)

        # Calculate commission stats
        completed_orders = orders.filter(status='completed')
        total_commission = sum(order.dealer_commission_amount for order in completed_orders)

        stats = {
            'total_orders': orders.count(),
            'pending_orders': orders.filter(status='pending_pricing').count(),
            'waiting_approval': orders.filter(status='waiting_customer_approval').count(),
            'confirmed_orders': orders.filter(status='confirmed').count(),
            'completed_orders': completed_orders.count(),
            'total_value': float(orders.filter(
                status='completed'
            ).aggregate(total=Sum('quoted_total'))['total'] or 0),
            'commission_rate': float(request.user.dealer_commission_rate),
            'total_commission_earned': float(total_commission)
        }

        return Response({
            'dealer': DealerSerializer(request.user).data,
            'stats': stats
        })


    @action(detail=True, methods=['POST'], url_path='send-custom-sms')
    def send_custom_sms(self, request, *args, **kwargs):
        """Admin sends custom SMS to customer"""
        if not request.user.is_staff:
            return Response({
                'error': 'Permission denied. Admin access required.'
            }, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()
        custom_message = request.data.get('message', '')

        if not custom_message:
            return Response({
                'error': 'Message is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not order.customer.phone:
            return Response({
                'error': 'Customer has no phone number'
            }, status=status.HTTP_400_BAD_REQUEST)

        sms_sent = NotificationService.send_sms_notification(
            phone=order.customer.phone,
            message=custom_message,
            order=order,
            sms_type='admin_custom'
        )

        return Response({
            'message': 'Custom SMS sent successfully' if sms_sent else 'Failed to send SMS',
            'sms_sent': sms_sent,
            'recipient': order.customer.phone
        })

    @action(detail=True, methods=['POST'], url_path='update-business-invoice-type')
    def update_business_invoice_type(self, request, pk=None):
        """Update business invoice type (admin only)"""
        order = self.get_object()

        # Check admin permissions
        if not request.user.is_staff:
            return Response({
                'error': 'فقط مدیر می‌تواند نوع فاکتور را تغییر دهد'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if order can be modified
        if order.status == 'completed':
            return Response({
                'error': 'نمی‌توان نوع فاکتور سفارش تکمیل شده را تغییر داد'
            }, status=status.HTTP_400_BAD_REQUEST)

        new_type = request.data.get('business_invoice_type')
        if new_type not in ['official', 'unofficial']:
            return Response({
                'error': 'نوع فاکتور نامعتبر است'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # If changing to official, validate customer info
            if new_type == 'official':
                is_valid, missing_fields = order.customer.validate_for_official_invoice()
                if not is_valid:
                    return Response({
                        'error': 'اطلاعات مشتری برای فاکتور رسمی کامل نیست',
                        'missing_fields': missing_fields,
                        'message': 'لطفاً ابتدا اطلاعات مشتری را تکمیل کنید'
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Update the invoice type
            order.business_invoice_type = new_type
            order.save()

            # Log the change
            OrderLog.objects.create(
                order=order,
                action='invoice_type_changed',
                description=f"Invoice type changed to {new_type} by {request.user.name}",
                performed_by=request.user
            )

            return Response({
                'message': 'نوع فاکتور با موفقیت تغییر یافت',
                'business_invoice_type': new_type,
                'business_invoice_type_display': 'فاکتور رسمی' if new_type == 'official' else 'فاکتور شخصی '
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to update invoice type for order {order.id}: {str(e)}")
            return Response({
                'error': f'خطا در تغییر نوع فاکتور: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['GET'], url_path='invoice-info')
    @action(detail=True, methods=['GET'], url_path='invoice-info')
    def get_invoice_info(self, request, pk=None):
        """Get invoice information and readiness status"""
        order = self.get_object()

        # Check permissions
        if not request.user.is_staff and order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            # Basic invoice info
            invoice_info = {
                'order_id': order.id,
                'business_invoice_type': order.business_invoice_type,
                'business_invoice_type_display': 'فاکتور رسمی' if order.business_invoice_type == 'official' else 'فاکتور شخصی',
                'status': order.status,
                'quoted_total': order.quoted_total,
                'has_invoice': hasattr(order, 'invoice'),
            }

            # Add invoice details if exists
            if hasattr(order, 'invoice'):
                invoice = order.invoice
                invoice_info.update({
                    'invoice_number': invoice.invoice_number,
                    'invoice_issued_at': invoice.issued_at,
                    'invoice_total_amount': invoice.total_amount,
                    'invoice_payable_amount': invoice.payable_amount,
                })

            # Check readiness for different invoice types
            if order.business_invoice_type == 'official':
                is_ready, missing_fields = order.customer.validate_for_official_invoice()
                invoice_info.update({
                    'ready_for_generation': is_ready,
                    'missing_fields': missing_fields,
                    'customer_info_complete': is_ready,
                })

                # Add tax calculation
                if order.quoted_total:
                    tax_amount = order.quoted_total * settings.DEFAULT_TAX_RATE
                    invoice_info.update({
                        'tax_rate': settings.DEFAULT_TAX_RATE,
                        'tax_amount': tax_amount,
                        'total_with_tax': order.quoted_total + tax_amount,
                    })
            else:
                # Unofficial invoice is always ready
                invoice_info.update({
                    'ready_for_generation': True,
                    'missing_fields': [],
                    'customer_info_complete': True,
                })

            # Available PDF types based on status
            available_pdfs = []

            if order.status == 'waiting_customer_approval':
                available_pdfs.append({
                    'type': 'pre_invoice',
                    'name': 'پیش فاکتور',
                    'description': 'معتبر تا انتها روز کاری'
                })

            if order.status in ['confirmed', 'payment_uploaded', 'completed']:
                if order.business_invoice_type == 'official':
                    available_pdfs.append({
                        'type': 'final_official',
                        'name': 'فاکتور رسمی',
                        'description': 'شامل مالیات ۹٪'
                    })
                else:
                    available_pdfs.append({
                        'type': 'final_unofficial',
                        'name': 'فاکتور شخصی',
                        'description': 'بدون مالیات'
                    })

            invoice_info['available_pdfs'] = available_pdfs

            return Response(invoice_info, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to get invoice info for order {order.id}: {str(e)}")
            return Response({
                'error': f'خطا در دریافت اطلاعات فاکتور: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def filter_by_business_type(self, request):
        """Filter orders by business invoice type"""
        business_type = request.query_params.get('type')
        if business_type not in ['official', 'unofficial']:
            return Response({
            'error': 'Invalid type. Use "official" or "unofficial"'
            }, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(business_invoice_type=business_type)
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'business_invoice_type': business_type,
            'results': serializer.data
        })

    @action(detail=True, methods=['GET'], url_path='download-pre-invoice')
    def download_pre_invoice(self, request, pk=None):
        """Download pre-invoice PDF (available after confirmation)"""
        order = self.get_object()

        # Check permissions
        if not request.user.is_staff and order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if pre-invoice can be downloaded
        if not order.can_download_pre_invoice:
            return Response({
                'error': 'Pre-invoice is not available for this order',
                'details': {
                    'status': order.status,
                    'has_invoice': hasattr(order, 'invoice'),
                    'invoice_type': order.invoice.invoice_type if hasattr(order, 'invoice') else None
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Generate pre-invoice PDF
            generator = PreInvoicePDFGenerator(order)
            return generator.get_http_response()

        except Exception as e:
            logger.error(f"Pre-invoice PDF generation failed for order {order.id}: {str(e)}")
            return Response({
                'error': f'Error generating pre-invoice: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['GET'], url_path='download-final-invoice')
    def download_final_invoice(self, request, pk=None):
        """Download final invoice PDF (available after payment verification)"""
        order = self.get_object()

        # Check permissions
        if not request.user.is_staff and order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if final invoice can be downloaded
        if not order.can_download_final_invoice:
            return Response({
                'error': 'Final invoice is not available for this order',
                'details': {
                    'status': order.status,
                    'has_invoice': hasattr(order, 'invoice'),
                    'invoice_type': order.invoice.invoice_type if hasattr(order, 'invoice') else None,
                    'payment_verified': order.payment_verified
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Determine which generator to use based on business_invoice_type
            if order.business_invoice_type == 'official':
                # Check if customer has complete info for official invoice
                is_valid, missing_fields = order.customer.validate_for_official_invoice()
                if not is_valid:
                    return Response({
                        'error': 'Customer information is incomplete for official invoice',
                        'missing_fields': missing_fields
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Use enhanced generator for official invoice
                invoice = order.invoice
                generator = EnhancedPersianInvoicePDFGenerator(invoice)

            else:
                # Use unofficial generator for unofficial invoice
                invoice = order.invoice
                generator = UnofficialInvoicePDFGenerator(order, invoice)

            return generator.get_http_response()

        except Exception as e:
            logger.error(f"Final invoice PDF generation failed for order {order.id}: {str(e)}")
            return Response({
                'error': f'Error generating final invoice: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['GET'], url_path='invoice-status')
    def get_invoice_status(self, request, pk=None):
        """Get comprehensive invoice status for an order"""
        order = self.get_object()

        # Check permissions
        if not request.user.is_staff and order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            invoice_status = {
                'order_id': order.id,
                'order_status': order.status,
                'business_invoice_type': order.business_invoice_type,
                'business_invoice_type_display': order.get_business_invoice_type_display(),
                'quoted_total': float(order.quoted_total) if order.quoted_total else 0,

                # Invoice existence
                'has_invoice': hasattr(order, 'invoice'),
                'invoice_type': order.invoice.invoice_type if hasattr(order, 'invoice') else None,

                # Pre-invoice availability
                'can_download_pre_invoice': order.can_download_pre_invoice,
                'pre_invoice_available': order.has_pre_invoice,

                # Final invoice availability
                'can_download_final_invoice': order.can_download_final_invoice,
                'final_invoice_available': order.has_final_invoice,

                # Payment status
                'payment_verified': order.payment_verified,
                'payment_verified_at': order.payment_verified_at,
                'has_payment_receipts': order.has_payment_receipts,
                'total_receipts_count': order.total_receipts_count if hasattr(order, 'total_receipts_count') else 0,
            }

            # Add invoice details if exists
            if hasattr(order, 'invoice'):
                invoice = order.invoice
                invoice_status.update({
                    'invoice_id': invoice.id,
                    'invoice_number': invoice.invoice_number,
                    'invoice_issued_at': invoice.issued_at,
                    'invoice_total_amount': float(invoice.total_amount),
                    'invoice_payable_amount': float(invoice.payable_amount),
                    'invoice_tax_amount': float(invoice.tax_amount),
                    'is_finalized': invoice.is_finalized,
                    'is_paid': invoice.is_paid,
                })

            # Check customer readiness for official invoice
            if order.business_invoice_type == 'official':
                is_ready, missing_fields = order.customer.validate_for_official_invoice()
                invoice_status.update({
                    'customer_ready_for_official': is_ready,
                    'missing_customer_fields': missing_fields,
                })

                # Add tax information
                if order.quoted_total:
                    tax_amount = order.get_tax_amount()
                    total_with_tax = order.get_total_with_tax()
                    invoice_status.update({
                        'tax_rate': float(settings.DEFAULT_TAX_RATE * 100),  # As percentage
                        'tax_amount': float(tax_amount),
                        'total_with_tax': float(total_with_tax),
                    })

            return Response(invoice_status, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to get invoice status for order {order.id}: {str(e)}")
            return Response({
                'error': f'Error getting invoice status: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['GET'], url_path='preview-pre-invoice')
    def preview_pre_invoice(self, request, pk=None):
        """Preview pre-invoice PDF in browser"""
        order = self.get_object()

        # Check permissions
        if not request.user.is_staff and order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if order is in correct status
        if order.status != 'waiting_customer_approval':
            return Response({
                'error': 'پیش فاکتور فقط برای سفارشات در انتظار تایید قابل مشاهده است'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Generate pre-invoice PDF for preview
            generator = PreInvoicePDFGenerator(order)
            buffer = generator.generate_pdf()

            response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="pre_invoice_{order.id}.pdf"'
            return response

        except Exception as e:
            logger.error(f"Pre-invoice PDF preview failed for order {order.id}: {str(e)}")
            return Response({
                'error': f'خطا در نمایش پیش فاکتور: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['GET'], url_path='download-invoice')
    def download_invoice(self, request, pk=None):
        """Download final invoice PDF (official or unofficial)"""
        order = self.get_object()

        # Check permissions
        if not request.user.is_staff and order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if order has been confirmed
        if order.status not in ['confirmed', 'payment_uploaded', 'completed']:
            return Response({
                'error': 'فاکتور نهایی فقط برای سفارشات تایید شده قابل دانلود است'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Determine which generator to use based on business_invoice_type
            if order.business_invoice_type == 'official':
                # Check if customer has complete info for official invoice
                is_valid, missing_fields = order.customer.validate_for_official_invoice()
                if not is_valid:
                    return Response({
                        'error': 'اطلاعات مشتری برای فاکتور رسمی کامل نیست',
                        'missing_fields': missing_fields
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Use enhanced generator for official invoice
                invoice = getattr(order, 'invoice', None)
                generator = EnhancedPersianInvoicePDFGenerator(invoice or order)

            else:
                # Use unofficial generator for unofficial invoice
                invoice = getattr(order, 'invoice', None)
                generator = UnofficialInvoicePDFGenerator(order, invoice)

            return generator.get_http_response()

        except Exception as e:
            logger.error(f"Invoice PDF generation failed for order {order.id}: {str(e)}")
            return Response({
                'error': f'خطا در تولید فاکتور: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['GET'], url_path='preview-invoice')
    def preview_invoice(self, request, pk=None):
        """Preview final invoice PDF in browser"""
        order = self.get_object()

        # Check permissions
        if not request.user.is_staff and order.customer != request.user:
            return Response({
                'error': 'دسترسی غیرمجاز'
            }, status=status.HTTP_403_FORBIDDEN)

        # Check if order has been confirmed
        if order.status not in ['confirmed', 'payment_uploaded', 'completed']:
            return Response({
                'error': 'فاکتور نهایی فقط برای سفارشات تایید شده قابل مشاهده است'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Determine which generator to use based on business_invoice_type
            if order.business_invoice_type == 'official':
                # Check if customer has complete info for official invoice
                is_valid, missing_fields = order.customer.validate_for_official_invoice()
                if not is_valid:
                    return Response({
                        'error': 'اطلاعات مشتری برای فاکتور رسمی کامل نیست',
                        'missing_fields': missing_fields
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Use enhanced generator for official invoice
                invoice = getattr(order, 'invoice', None)
                generator = EnhancedPersianInvoicePDFGenerator(invoice or order)
                buffer = generator.generate_pdf()
                filename = f"invoice_{order.id}_official.pdf"

            else:
                # Use unofficial generator for unofficial invoice
                invoice = getattr(order, 'invoice', None)
                generator = UnofficialInvoicePDFGenerator(order, invoice)
                buffer = generator.generate_pdf()
                filename = f"invoice_{order.id}_unofficial.pdf"

            response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return response

        except Exception as e:
            logger.error(f"Invoice PDF preview failed for order {order.id}: {str(e)}")
            return Response({
                'error': f'خطا در نمایش فاکتور: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OrderItemViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = OrderItemSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return OrderItem.objects.all()
        elif user.is_dealer:
            # Dealers can see items from their assigned orders
            return OrderItem.objects.filter(
                Q(order__customer=user) | Q(order__assigned_dealer=user)
            ).distinct()
        else:
            return OrderItem.objects.filter(order__customer=user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_payment_receipt(request, receipt_id):
    try:
        # Find the specific receipt
        receipt = get_object_or_404(OrderPaymentReceipt, pk=receipt_id)

        # Security Check: Ensure user has permission
        user = request.user
        order = receipt.order

        has_permission = (
                user.is_staff or
                user == order.customer or
                user == order.assigned_dealer
        )

        if not has_permission:
            logger.warning(f"❌ Unauthorized access attempt to receipt {receipt_id} by user {user.id}")
            return HttpResponse("Permission denied", status=403)

        # Check if file exists
        if not receipt.receipt_file or not receipt.receipt_file.name:
            logger.error(f"❌ Receipt {receipt_id} has no file attached")
            return HttpResponse("File not found", status=404)

        try:
            # Open the file
            file_handle = receipt.receipt_file.open('rb')

            # Get the file extension and determine content type
            file_path = receipt.receipt_file.name
            content_type, encoding = mimetypes.guess_type(file_path)

            # Fallback content types based on our file_type field
            if not content_type:
                if receipt.file_type == 'pdf':
                    content_type = 'application/pdf'
                elif receipt.file_type == 'images':
                    # Try to determine images type from extension
                    ext = os.path.splitext(file_path)[1].lower()
                    content_type_map = {
                        '.jpg': 'images/jpeg',
                        '.jpeg': 'images/jpeg',
                        '.png': 'images/png',
                        '.gif': 'images/gif',
                        '.webp': 'images/webp'
                    }
                    content_type = content_type_map.get(ext, 'images/jpeg')
                else:
                    content_type = 'application/octet-stream'

            # Create response with proper headers
            response = HttpResponse(file_handle.read(), content_type=content_type)

            # Set headers for proper display/download
            filename = receipt.file_name or f"receipt_{receipt.id}"

            # For PDFs and images, show inline by default
            if receipt.file_type in ['pdf', 'images']:
                response['Content-Disposition'] = f'inline; filename="{filename}"'
            else:
                response['Content-Disposition'] = f'attachment; filename="{filename}"'

            # Set cache headers
            response['Cache-Control'] = 'private, max-age=3600'

            # Set content length
            if hasattr(receipt.receipt_file, 'size'):
                response['Content-Length'] = receipt.receipt_file.size

            logger.info(f"✅ Serving receipt {receipt_id} ({receipt.file_type}) to user {user.id}")
            return response

        except Exception as file_error:
            logger.error(f"❌ Error reading receipt file {receipt_id}: {str(file_error)}")
            return HttpResponse("Error reading file", status=500)

    except Http404:
        logger.error(f"❌ Receipt {receipt_id} not found")
        return HttpResponse("Receipt not found", status=404)
    except Exception as e:
        logger.error(f"❌ Unexpected error serving receipt {receipt_id}: {str(e)}")
        return HttpResponse("Internal server error", status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_payment_receipt(request, receipt_id):
    try:
        # Find the specific receipt
        receipt = get_object_or_404(OrderPaymentReceipt, pk=receipt_id)

        # Security Check
        user = request.user
        order = receipt.order

        has_permission = (
                user.is_staff or
                user == order.customer or
                user == order.assigned_dealer
        )

        if not has_permission:
            logger.warning(f"❌ Unauthorized download attempt for receipt {receipt_id} by user {user.id}")
            return HttpResponse("Permission denied", status=403)

        # Check if file exists
        if not receipt.receipt_file or not receipt.receipt_file.name:
            logger.error(f"❌ Receipt {receipt_id} has no file for download")
            return HttpResponse("File not found", status=404)

        try:
            # Open file for download
            file_handle = receipt.receipt_file.open('rb')

            # Determine content type
            file_path = receipt.receipt_file.name
            content_type, encoding = mimetypes.guess_type(file_path)

            if not content_type:
                if receipt.file_type == 'pdf':
                    content_type = 'application/pdf'
                elif receipt.file_type == 'images':
                    content_type = 'application/octet-stream'  # Force download for images
                else:
                    content_type = 'application/octet-stream'

            # Create download response
            response = HttpResponse(file_handle.read(), content_type=content_type)

            # Force download with attachment header
            filename = receipt.file_name or f"receipt_{receipt_id}_{receipt.file_type}"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'

            # Set additional headers
            if hasattr(receipt.receipt_file, 'size'):
                response['Content-Length'] = receipt.receipt_file.size

            response['Cache-Control'] = 'no-cache'

            logger.info(f"✅ Download initiated for receipt {receipt_id} by user {user.id}")
            return response

        except Exception as file_error:
            logger.error(f"❌ Error downloading receipt file {receipt_id}: {str(file_error)}")
            return HttpResponse("Error downloading file", status=500)

    except Http404:
        logger.error(f"❌ Receipt {receipt_id} not found for download")
        return HttpResponse("Receipt not found", status=404)
    except Exception as e:
        logger.error(f"❌ Unexpected error downloading receipt {receipt_id}: {str(e)}")
        return HttpResponse("Internal server error", status=500)

