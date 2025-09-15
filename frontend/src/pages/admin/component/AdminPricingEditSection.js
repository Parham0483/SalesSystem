import React, { useState, useEffect } from 'react';
import API from '../../../component/api';
import NeoBrutalistCard from '../../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from '../../../component/NeoBrutalist/NeoBrutalistInput';
import { PersianNumberFormatter } from'../../../utils/persianNumberFormatter';

// Enhanced Input Component with Auto-formatting
const PersianFormattedInput = ({
                                   value,
                                   onChange,
                                   placeholder,
                                   disabled,
                                   min = "0",
                                   step = "1000",
                                   style = {},
                                   className = "",
                                   ...props
                               }) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused && value && value !== '') {
            setDisplayValue(PersianNumberFormatter.formatPrice(value, false));
        } else if (!value || value === '') {
            setDisplayValue('');
        }
    }, [value, isFocused]);

    const handleFocus = (e) => {
        setIsFocused(true);
        if (value && parseFloat(value) > 0) {
            setDisplayValue(value.toString());
        }
    };

    const handleBlur = (e) => {
        setIsFocused(false);
        const rawValue = e.target.value.replace(/[^\d.]/g, '');
        const numericValue = parseFloat(rawValue) || 0;

        if (onChange) {
            onChange({ target: { value: numericValue } });
        }

        if (numericValue > 0) {
            setDisplayValue(PersianNumberFormatter.formatPrice(numericValue, false));
        } else {
            setDisplayValue('');
        }
    };

    const handleChange = (e) => {
        const newValue = e.target.value;
        setDisplayValue(newValue);

        const numericValue = parseFloat(newValue.replace(/[^\d.]/g, '')) || 0;
        if (onChange && isFocused) {
            onChange({ target: { value: numericValue } });
        }
    };

    return (
        <input
            type="text"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={`persian-formatted-input ${className}`}
            style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.9rem',
                textAlign: 'center',
                direction: 'ltr',
                fontFamily: 'Tahoma, Arial, sans-serif',
                border: '4px solid #000',
                boxShadow: '6px 6px 0 #000',
                backgroundColor: 'white',
                color: '#1a1a1a',
                outline: 'none',
                transition: 'all 0.2s ease',
                opacity: disabled ? 0.6 : 1,
                cursor: disabled ? 'not-allowed' : 'text',
                ...style
            }}
            {...props}
        />
    );
};

// FIXED: Updated component props to include the missing callbacks
const AdminPricingEditSection = ({
                                     order,
                                     onUpdate,
                                     onOrderListRefresh,
                                     onMajorStatusChange
                                 }) => {
    const [editing, setEditing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reopening, setReopening] = useState(false);
    const [items, setItems] = useState(order.items || []);
    const [adminComment, setAdminComment] = useState(order.admin_comment || '');
    const [notifyCustomer, setNotifyCustomer] = useState(false);
    const [error, setError] = useState('');

    // FIXED: Added missing refreshKey state
    const [refreshKey, setRefreshKey] = useState(0);

    // Configuration for future implementation
    const FUTURE_FEATURES = {
        ALLOW_POST_PAYMENT_EDIT: false, // Set to true to enable future post-payment editing
        ALLOW_COMPLETED_EDIT: false,    // Set to true to enable editing completed orders
        REQUIRE_SPECIAL_PERMISSION: false, // Set to true to require special admin permissions
    };

    useEffect(() => {
        setItems(order.items || []);
        setAdminComment(order.admin_comment || '');
    }, [order]);

    // Enhanced calculation functions
    const calculateItemTax = (unitPrice, quantity, taxRate) => {
        return PersianNumberFormatter.calculateTax(unitPrice, quantity, taxRate);
    };

    const calculateItemTotalWithTax = (unitPrice, quantity, taxRate) => {
        return PersianNumberFormatter.calculateTotalWithTax(unitPrice, quantity, taxRate);
    };

    // FINAL: Complete business logic with future-proofing
    const getEditPermissions = () => {
        const status = order.status;
        const hasPaymentReceipts = order.has_payment_receipts || order.payment_receipts_count > 0;

        // HARD LOCK: No editing after payment upload (unless future config allows)
        const isPaymentUploaded = status === 'payment_uploaded';
        const isCompleted = status === 'completed';

        // Future-proofing: check configuration flags
        const postPaymentEditAllowed = FUTURE_FEATURES.ALLOW_POST_PAYMENT_EDIT;
        const completedEditAllowed = FUTURE_FEATURES.ALLOW_COMPLETED_EDIT;

        return {
            // Basic editing permissions
            canStartEditing: (
                status === 'pending_pricing' ||
                (status === 'waiting_customer_approval' && !hasPaymentReceipts) ||
                (status === 'confirmed' && !hasPaymentReceipts) ||
                // Future features
                (isPaymentUploaded && postPaymentEditAllowed) ||
                (isCompleted && completedEditAllowed)
            ),

            // Reopen permissions - BLOCKED for payment_uploaded
            canReopen: (
                (status === 'waiting_customer_approval' || status === 'confirmed') &&
                !isPaymentUploaded && // HARD BLOCK
                !isCompleted
            ),

            // Payment evidence detection
            hasPaymentEvidence: hasPaymentReceipts || isPaymentUploaded,

            // Direct edit permissions
            directEditAllowed: status === 'pending_pricing',

            // COMPLETE LOCKDOWN after payment upload
            completelyLocked: (
                isPaymentUploaded || isCompleted
            ) && !postPaymentEditAllowed && !completedEditAllowed,

            // Status flags
            isPaymentUploaded,
            isCompleted,
            hasPaymentReceipts,

            // Future feature flags
            futureEditingEnabled: postPaymentEditAllowed || completedEditAllowed
        };
    };

    const permissions = getEditPermissions();

    // REMOVED: Reopen functionality for payment_uploaded status
    const handleReopenForPricing = async () => {
        // Block if payment uploaded or completed
        if (permissions.isPaymentUploaded || permissions.isCompleted) {
            alert('امکان بازگشایی سفارش در این مرحله وجود ندارد زیرا رسید پرداخت ارسال شده است.');
            return;
        }

        let confirmMessage = 'آیا مطمئن هستید که می‌خواهید این سفارش را برای ویرایش قیمت‌گذاری بازگشایی کنید؟';

        if (permissions.hasPaymentEvidence) {
            confirmMessage = 'هشدار: مشتری قبلاً رسید پرداخت ارسال کرده است. بازگشایی این سفارش نیاز به توجیه دارد. ادامه می‌دهید؟';
        }

        if (!window.confirm(confirmMessage)) {
            return;
        }

        setReopening(true);
        setError('');

        try {
            const response = await API.post(`/orders/${order.id}/reopen-for-pricing/`);
            if (response.status === 200) {
                alert('سفارش برای ویرایش قیمت‌گذاری بازگشایی شد');
                if (onUpdate) {
                    onUpdate();
                }
            }
        } catch (err) {
            console.error('Error reopening order for pricing:', err);
            const errorMessage = err.response?.data?.error || 'خطا در بازگشایی سفارش';
            setError(errorMessage);
        } finally {
            setReopening(false);
        }
    };

    const handleStartEditing = () => {
        // COMPLETE BLOCK for locked orders
        if (permissions.completelyLocked) {
            if (permissions.isPaymentUploaded) {
                alert('امکان ویرایش وجود ندارد: رسید پرداخت ارسال شده و معامله قطعی شده است.');
            } else if (permissions.isCompleted) {
                alert('امکان ویرایش وجود ندارد: سفارش تکمیل شده است.');
            }
            return;
        }

        if (permissions.hasPaymentEvidence) {
            const confirmMessage = 'هشدار: این سفارش در مرحله پیشرفته‌ای قرار دارد. تغییر قیمت نیاز به اطلاع‌رسانی مجدد به مشتری دارد. ادامه می‌دهید؟';
            if (!window.confirm(confirmMessage)) {
                return;
            }
            setNotifyCustomer(true);
        }

        setEditing(true);
        setError('');
    };

    const handleCancelEditing = () => {
        setEditing(false);
        setItems(order.items || []);
        setAdminComment(order.admin_comment || '');
        setNotifyCustomer(false);
        setError('');
    };

    const updateItem = (index, field, value) => {
        // Block updates if completely locked
        if (permissions.completelyLocked && !editing) {
            return;
        }

        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSubmitPricingUpdate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            // Block submission if completely locked
            if (permissions.completelyLocked) {
                setError('امکان ویرایش در این مرحله وجود ندارد');
                setSubmitting(false);
                return;
            }

            if (permissions.hasPaymentEvidence && !notifyCustomer) {
                setError('برای تغییر قیمت در این مرحله، اطلاع‌رسانی به مشتری الزامی است');
                setSubmitting(false);
                return;
            }

            const hasValidItems = items.some(item =>
                item.quoted_unit_price && parseFloat(item.quoted_unit_price) > 0 &&
                item.final_quantity && parseInt(item.final_quantity) > 0
            );

            if (!hasValidItems) {
                setError('لطفاً حداقل برای یک محصول قیمت و تعداد نهایی را وارد کنید');
                setSubmitting(false);
                return;
            }

            const submissionData = {
                admin_comment: adminComment || '',
                notify_customer: Boolean(notifyCustomer),
                post_payment_modification: permissions.hasPaymentEvidence,
                items: items.map(item => {
                    const itemData = {
                        id: parseInt(item.id),
                        quoted_unit_price: parseFloat(item.quoted_unit_price) || 0,
                        final_quantity: parseInt(item.final_quantity) || 0,
                        admin_notes: item.admin_notes || '',
                    };

                    if (itemData.quoted_unit_price <= 0) {
                        throw new Error(`قیمت محصول ${item.product_name} باید بیشتر از صفر باشد`);
                    }
                    if (itemData.final_quantity <= 0) {
                        throw new Error(`تعداد محصول ${item.product_name} باید بیشتر از صفر باشد`);
                    }

                    return itemData;
                })
            };

            console.log('Submitting pricing data:', JSON.stringify(submissionData, null, 2));

            const response = await API.post(`/orders/${order.id}/update-pricing/`, submissionData);

            if (response.status === 200) {
                const pricingChanges = response.data.pricing_changes || {};
                const notificationStatus = response.data.notification_sent || false;
                const statusChanged = response.data.pricing_changes?.status_changed_to;

                let message = 'قیمت‌گذاری با موفقیت به‌روزرسانی شد';

                if (pricingChanges.changed) {
                    message += `\nمبلغ کل از ${PersianNumberFormatter.formatPrice(pricingChanges.old_total)} به ${PersianNumberFormatter.formatPrice(pricingChanges.new_total)} تغییر یافت`;
                }

                if (statusChanged) {
                    message += `\nوضعیت سفارش به "${statusChanged}" تغییر یافت`;
                }

                if (notifyCustomer && notificationStatus) {
                    message += '\nاطلاع‌رسانی به مشتری ارسال شد';
                } else if (notifyCustomer && !notificationStatus) {
                    message += '\nخطا در ارسال اطلاع‌رسانی به مشتری';
                }

                alert(message);
                setEditing(false);

                // FIXED: Enhanced refresh strategies with proper error handling
                try {
                    // 1. Call the onUpdate callback (refreshes current order detail)
                    if (onUpdate) {
                        await onUpdate();
                    }

                    // 2. If there's a parent list refresh callback, call it
                    if (onOrderListRefresh) {
                        await onOrderListRefresh();
                    }

                    // 3. Force a small delay then refresh current component state
                    setTimeout(() => {
                        // Reset local state to match new server state
                        setItems(response.data.updated_order?.items || order.items || []);
                        setAdminComment(response.data.updated_order?.admin_comment || adminComment);

                        // Force component re-render by updating refresh key
                        setRefreshKey(prev => prev + 1);
                    }, 500);

                    // 4. If status changed significantly, trigger major status change
                    if (statusChanged && (statusChanged === 'waiting_customer_approval' || statusChanged === 'confirmed')) {
                        console.log('Order status changed significantly, triggering refresh');

                        if (onMajorStatusChange) {
                            await onMajorStatusChange(statusChanged);
                        }
                    }
                } catch (refreshError) {
                    console.error('Error during refresh operations:', refreshError);
                    // Don't fail the main operation if refresh fails
                }
            }

        } catch (err) {
            console.error('Error updating pricing:', err);

            let errorMessage = 'خطا در به‌روزرسانی قیمت‌گذاری';

            if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err.response?.data?.details) {
                const details = err.response.data.details;
                if (details.items) {
                    errorMessage = 'خطا در اعتبارسنجی اقلام: ' + JSON.stringify(details.items);
                } else if (details.non_field_errors) {
                    errorMessage = details.non_field_errors.join(', ');
                } else {
                    errorMessage = 'خطا در اعتبارسنجی داده‌ها: ' + JSON.stringify(details);
                }
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const calculateOrderTotal = () => {
        const subtotal = items.reduce((sum, item) => {
            if (item.quoted_unit_price && item.final_quantity) {
                return sum + (parseFloat(item.quoted_unit_price) * parseInt(item.final_quantity));
            }
            return sum;
        }, 0);

        if (subtotal === 0) return 'در انتظار محاسبه';

        if (order.business_invoice_type === 'official') {
            const totalTax = items.reduce((sum, item) => {
                const itemTax = calculateItemTax(item.quoted_unit_price, item.final_quantity, item.product_tax_rate);
                return sum + itemTax;
            }, 0);

            const totalWithTax = subtotal + totalTax;

            return (
                <div className="total-breakdown" style={{
                    textAlign: 'right',
                    direction: 'rtl',
                    fontFamily: 'Tahoma, sans-serif'
                }}>
                    <div>مجموع: {PersianNumberFormatter.formatPrice(subtotal)}</div>
                    <div>مالیات: {PersianNumberFormatter.formatPrice(totalTax)}</div>
                    <div style={{
                        fontWeight: 'bold',
                        color: '#dc2626',
                        borderTop: '2px solid #ddd',
                        paddingTop: '0.5rem',
                        marginTop: '0.5rem'
                    }}>
                        کل با مالیات: {PersianNumberFormatter.formatPrice(totalWithTax)}
                    </div>
                </div>
            );
        }

        return PersianNumberFormatter.formatPrice(subtotal);
    };

    // Status checks
    const isWaitingApproval = order.status === 'waiting_customer_approval';
    const isPendingPricing = order.status === 'pending_pricing';
    const isConfirmed = order.status === 'confirmed';
    const isPaymentUploaded = order.status === 'payment_uploaded';
    const isCompleted = order.status === 'completed';

    // FINAL: Strict edit permissions with complete lockdown
    const canEdit = (
        isPendingPricing ||
        (editing && permissions.canStartEditing && !permissions.completelyLocked)
    );

    const showEditingInterface = (
        isPendingPricing || isWaitingApproval || isConfirmed ||
        (isPaymentUploaded && permissions.futureEditingEnabled) ||
        (isCompleted && permissions.futureEditingEnabled)
    );

    const isOfficialInvoice = order?.business_invoice_type === 'official';

    // Don't show for cancelled and rejected orders
    if (order.status === 'cancelled' || order.status === 'rejected') {
        return null;
    }

    // SPECIAL: Show locked state for completely locked orders
    if (permissions.completelyLocked && !showEditingInterface) {
        return (
            <NeoBrutalistCard className="admin-pricing-edit-card" style={{
                borderLeft: '6px solid #6b7280',
                opacity: 0.8
            }}>
                <div className="admin-card-header">
                    <h2 className="admin-card-title">قیمت‌گذاری (قفل شده)</h2>
                </div>

                <div className="locked-state-message" style={{
                    backgroundColor: '#f3f4f6',
                    border: '2px solid #6b7280',
                    padding: '2rem',
                    borderRadius: '8px',
                    textAlign: 'center',
                    color: '#374151',
                    fontFamily: 'IRANSans, Tahoma, Arial, sans-serif'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                        {isPaymentUploaded ? 'رسید پرداخت ارسال شده' : 'سفارش تکمیل شده'}
                    </div>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                        {isPaymentUploaded
                            ? 'مشتری رسید پرداخت ارسال کرده و معامله قطعی شده است. امکان ویرایش قیمت وجود ندارد.'
                            : 'این سفارش تکمیل شده و امکان ویرایش قیمت وجود ندارد.'
                        }
                    </div>

                    {/* Future implementation note */}
                    <div style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        color: '#6b7280'
                    }}>
                        💡 برای فعال‌سازی ویرایش در آینده، تنظیمات FUTURE_FEATURES را تغییر دهید
                    </div>
                </div>

                {/* Read-only order total display */}
                <div className="admin-order-total-section" style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    backgroundColor: '#f9fafb',
                    border: '2px solid #e5e7eb',
                    borderRadius: '6px'
                }}>
                    <h4 style={{
                        fontFamily: 'Bebas Neue, sans-serif',
                        fontSize: '1.25rem',
                        margin: '0 0 1rem 0',
                        textAlign: 'right',
                        direction: 'rtl',
                        color: '#6b7280'
                    }}>
                        جمع کل سفارش (نهایی)
                    </h4>
                    <div style={{
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        textAlign: 'right',
                        direction: 'rtl',
                        color: '#374151'
                    }}>
                        {calculateOrderTotal()}
                    </div>
                </div>
            </NeoBrutalistCard>
        );
    }

    return (
        <NeoBrutalistCard className="admin-pricing-edit-card" style={{ borderLeft: '6px solid #3b82f6' }} key={refreshKey}>
            <div className="admin-card-header">
                <h2 className="admin-card-title">
                    {isPendingPricing ? 'قیمت‌گذاری و جزئیات' :
                        isWaitingApproval ? 'بررسی و ویرایش قیمت‌گذاری (در انتظار تایید مشتری)' :
                            isConfirmed ? 'ویرایش قیمت‌گذاری (سفارش تایید شده)' :
                                isPaymentUploaded ? 'مشاهده قیمت‌گذاری (رسید پرداخت آپلود شده)' :
                                    isCompleted ? 'مشاهده قیمت‌گذاری (تکمیل شده)' :
                                        'مدیریت قیمت‌گذاری'}
                </h2>

                <div className="admin-pricing-edit-actions">
                    {/* Show edit button only when allowed */}
                    {!editing && permissions.canStartEditing && !permissions.completelyLocked && (
                        <div className="button-group">
                            <NeoBrutalistButton
                                text="✏️ ویرایش قیمت‌ها"
                                color="blue-400"
                                textColor="white"
                                onClick={handleStartEditing}
                                className="edit-pricing-btn"
                            />
                        </div>
                    )}

                    {/* Show reopen option when allowed */}
                    {!editing && permissions.canReopen && !permissions.completelyLocked && (
                        <div className="button-group">
                            <NeoBrutalistButton
                                text={reopening ? "در حال بازگشایی..." : "🔄 بازگشایی برای قیمت‌گذاری"}
                                color="orange-400"
                                textColor="black"
                                onClick={handleReopenForPricing}
                                disabled={reopening}
                                className="reopen-pricing-btn"
                            />
                        </div>
                    )}

                    {editing && (
                        <div className="button-group">
                            <NeoBrutalistButton
                                text="❌ انصراف"
                                color="gray-400"
                                textColor="black"
                                onClick={handleCancelEditing}
                                className="cancel-edit-btn"
                            />
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div className="admin-error-message" style={{
                    backgroundColor: '#fee2e2',
                    border: '2px solid #dc2626',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    color: '#dc2626',
                    marginBottom: '1rem',
                    fontFamily: 'IRANSans, Tahoma, Arial, sans-serif'
                }}>
                    <span>⚠️ {error}</span>
                </div>
            )}

            {/* Enhanced status info with complete lockdown indicators */}
            <div className="pricing-status-info" style={{ marginBottom: '1rem' }}>
                <div className="status-badges">
                    <span className={`status-badge ${
                        isPendingPricing ? 'pending-pricing' :
                            isWaitingApproval ? 'waiting-approval' :
                                isConfirmed ? 'confirmed' :
                                    isPaymentUploaded ? 'payment-uploaded' :
                                        isCompleted ? 'completed' : 'unknown'
                    }`}>
                        {isPendingPricing ? '📋 در حال قیمت‌گذاری' :
                            isWaitingApproval ? '⏰ در انتظار تایید مشتری' :
                                isConfirmed ? '✅ تایید شده توسط مشتری' :
                                    isPaymentUploaded ? '💳 رسید پرداخت آپلود شده' :
                                        isCompleted ? '🎉 تکمیل شده' :
                                            '❓ وضعیت نامشخص'}
                    </span>
                    {editing && (
                        <span className="status-badge editing">
                            ✏️ در حال ویرایش
                        </span>
                    )}
                    {permissions.completelyLocked && (
                        <span className="status-badge locked" style={{
                            backgroundColor: '#374151',
                            color: 'white'
                        }}>
                            🔒 قفل شده
                        </span>
                    )}
                </div>

                {/* Status-specific warnings */}
                {isPaymentUploaded && (
                    <div className="status-info" style={{
                        backgroundColor: '#fef2f2',
                        padding: '1rem',
                        borderRadius: '4px',
                        marginTop: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#dc2626',
                        border: '2px solid #dc2626'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            🚫 رسید پرداخت ارسال شده - ویرایش غیرفعال
                        </div>
                        <div>
                            مشتری رسید پرداخت ارسال کرده و معامله قطعی شده است. امکان ویرایش قیمت وجود ندارد.
                        </div>
                    </div>
                )}

                {isCompleted && (
                    <div className="status-info" style={{
                        backgroundColor: '#f0fdf4',
                        padding: '1rem',
                        borderRadius: '4px',
                        marginTop: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#166534',
                        border: '2px solid #22c55e'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            ✅ سفارش تکمیل شده
                        </div>
                        <div>
                            این سفارش به اتمام رسیده و امکان ویرایش قیمت وجود ندارد.
                        </div>
                    </div>
                )}
            </div>

            <form className="admin-pricing-form" onSubmit={handleSubmitPricingUpdate}>
                {/* Admin Comment */}
                <div className="admin-comment-section">
                    <h3 className="admin-comment-title">نظر مدیر</h3>
                    <textarea
                        className="admin-comment-textarea"
                        value={adminComment}
                        onChange={e => setAdminComment(e.target.value)}
                        placeholder="نظرات و توضیحات مدیر برای این سفارش..."
                        rows={4}
                        disabled={!canEdit}
                        style={{
                            opacity: canEdit ? 1 : 0.6,
                            cursor: canEdit ? 'text' : 'not-allowed',
                            backgroundColor: permissions.completelyLocked ? '#f9fafb' : 'white'
                        }}
                    />
                </div>

                {/* Items Table */}
                <div className="admin-items-section">
                    <h3 className="admin-section-title">محصولات</h3>
                    <div
                        className="admin-items-table"
                        data-invoice-type={order.business_invoice_type || 'unofficial'}
                    >
                        <div className="admin-table-header">
                            <div className="admin-header-cell">نام محصول</div>
                            <div className="admin-header-cell">تعداد درخواستی</div>
                            <div className="admin-header-cell">نظر مشتری</div>
                            <div className="admin-header-cell">قیمت واحد (ریال)</div>
                            <div className="admin-header-cell">تعداد نهایی</div>
                            {isOfficialInvoice && (
                                <>
                                    <div className="admin-header-cell">نرخ مالیات (%)</div>
                                    <div className="admin-header-cell">مبلغ مالیات (ریال)</div>
                                </>
                            )}
                            <div className="admin-header-cell">نظر مدیر</div>
                            <div className="admin-header-cell">جمع کل</div>
                        </div>

                        {items.map((item, idx) => (
                            <div key={item.id} className="admin-table-row">
                                <div className="admin-table-cell admin-product-name" title={item.product_name}>
                                    {item.product_name}
                                </div>
                                <div className="admin-table-cell">
                                    {PersianNumberFormatter.formatQuantity(item.requested_quantity)}
                                </div>
                                <div className="admin-table-cell admin-customer-notes" title={item.customer_notes}>
                                    {item.customer_notes || '-'}
                                </div>
                                <div className="admin-table-cell admin-input-cell">
                                    <PersianFormattedInput
                                        value={item.quoted_unit_price || ''}
                                        onChange={e => updateItem(idx, 'quoted_unit_price', e.target.value)}
                                        placeholder="قیمت"
                                        min="0"
                                        step="1000"
                                        disabled={!canEdit}
                                        style={{
                                            opacity: canEdit ? 1 : 0.6,
                                            cursor: canEdit ? 'text' : 'not-allowed',
                                            backgroundColor: permissions.completelyLocked ? '#f9fafb' : 'white'
                                        }}
                                    />
                                </div>
                                <div className="admin-table-cell admin-input-cell">
                                    <PersianFormattedInput
                                        value={item.final_quantity || ''}
                                        onChange={e => updateItem(idx, 'final_quantity', e.target.value)}
                                        placeholder="تعداد"
                                        min="0"
                                        disabled={!canEdit}
                                        style={{
                                            opacity: canEdit ? 1 : 0.6,
                                            cursor: canEdit ? 'text' : 'not-allowed',
                                            backgroundColor: permissions.completelyLocked ? '#f9fafb' : 'white'
                                        }}
                                    />
                                </div>

                                {isOfficialInvoice && (
                                    <>
                                        <div className="admin-table-cell">
                                            <span className="tax-rate-display" style={{
                                                fontWeight: 'bold',
                                                color: '#059669',
                                                fontSize: '0.9rem',
                                                direction: 'rtl'
                                            }}>
                                                {item.product_tax_rate ? `${parseFloat(item.product_tax_rate).toFixed(1)}%` : '0%'}
                                            </span>
                                        </div>
                                        <div className="admin-table-cell admin-tax-cell">
                                            <span className="live-calculation" style={{
                                                fontWeight: 'bold',
                                                color: '#dc2626',
                                                fontSize: '0.95rem',
                                                fontFamily: 'Tahoma, sans-serif',
                                                direction: 'rtl',
                                                textAlign: 'center'
                                            }}>
                                                {PersianNumberFormatter.formatPrice(
                                                    calculateItemTax(item.quoted_unit_price, item.final_quantity, item.product_tax_rate)
                                                )}
                                            </span>
                                        </div>
                                    </>
                                )}

                                <div className="admin-table-cell admin-input-cell">
                                    <NeoBrutalistInput
                                        type="text"
                                        value={item.admin_notes || ''}
                                        onChange={e => updateItem(idx, 'admin_notes', e.target.value)}
                                        placeholder="نظر مدیر"
                                        disabled={!canEdit}
                                        style={{
                                            opacity: canEdit ? 1 : 0.6,
                                            cursor: canEdit ? 'text' : 'not-allowed',
                                            backgroundColor: permissions.completelyLocked ? '#f9fafb' : 'white'
                                        }}
                                    />
                                </div>
                                <div className="admin-table-cell admin-total-cell">
                                    <span className="live-calculation" style={{
                                        fontWeight: 'bold',
                                        color: '#059669',
                                        fontSize: '1rem',
                                        fontFamily: 'Tahoma, sans-serif',
                                        direction: 'rtl',
                                        textAlign: 'center'
                                    }}>
                                        {isOfficialInvoice
                                            ? PersianNumberFormatter.formatPrice(
                                                calculateItemTotalWithTax(item.quoted_unit_price, item.final_quantity, item.product_tax_rate)
                                            )
                                            : PersianNumberFormatter.formatPrice(
                                                PersianNumberFormatter.calculateAndFormatTotal(item.quoted_unit_price, item.final_quantity, false)
                                            )
                                        }
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Order Total Section */}
                <div className="admin-order-total-section" style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    backgroundColor: permissions.completelyLocked ? '#f9fafb' : '#f8fafc',
                    border: '2px solid #e2e8f0',
                    borderRadius: '6px'
                }}>
                    <h4 style={{
                        fontFamily: 'Bebas Neue, sans-serif',
                        fontSize: '1.25rem',
                        margin: '0 0 1rem 0',
                        textAlign: 'right',
                        direction: 'rtl'
                    }}>
                        جمع کل سفارش {permissions.completelyLocked ? '(نهایی)' : ''}
                    </h4>
                    <div style={{
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        textAlign: 'right',
                        direction: 'rtl'
                    }}>
                        {calculateOrderTotal()}
                    </div>
                </div>

                {/* Customer notification - only if editing is allowed */}
                {editing && !permissions.completelyLocked && (
                    <div className="customer-notification-section" style={{ margin: '1rem 0' }}>
                        <label className="notification-checkbox-container" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem',
                            fontFamily: 'IRANSans, Tahoma, Arial, sans-serif',
                            cursor: 'pointer',
                            padding: '0.75rem',
                            backgroundColor: permissions.hasPaymentEvidence ? '#fef2f2' : '#f8fafc',
                            border: `2px solid ${permissions.hasPaymentEvidence ? '#dc2626' : '#e2e8f0'}`,
                            borderRadius: '6px'
                        }}>
                            <input
                                type="checkbox"
                                checked={notifyCustomer}
                                onChange={e => setNotifyCustomer(e.target.checked)}
                                disabled={permissions.hasPaymentEvidence}
                                style={{
                                    width: '1.2rem',
                                    height: '1.2rem',
                                    cursor: permissions.hasPaymentEvidence ? 'not-allowed' : 'pointer'
                                }}
                            />
                            <span>
                                ارسال اطلاع‌رسانی تغییرات قیمت به مشتری
                                {permissions.hasPaymentEvidence && ' (الزامی)'}
                            </span>
                        </label>

                        {permissions.hasPaymentEvidence && (
                            <div className="notification-warning" style={{
                                fontSize: '0.8rem',
                                color: '#dc2626',
                                marginTop: '0.5rem',
                                padding: '0.5rem',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: '4px',
                                fontFamily: 'IRANSans, Tahoma, Arial, sans-serif'
                            }}>
                                اطلاع‌رسانی به مشتری در این مرحله الزامی است زیرا او قبلاً رسید پرداخت ارسال کرده است.
                            </div>
                        )}
                    </div>
                )}

                {/* Submit Section - only if editing is allowed */}
                {canEdit && !permissions.completelyLocked && (
                    <div className="admin-submit-section">
                        <NeoBrutalistButton
                            text={submitting ? "در حال به‌روزرسانی..." :
                                isPendingPricing ? "ثبت قیمت‌گذاری" :
                                    permissions.hasPaymentEvidence ? "ثبت تغییرات (پس از پرداخت)" :
                                        "ثبت تغییرات قیمت‌گذاری"}
                            color={isPendingPricing ? "yellow-400" :
                                permissions.hasPaymentEvidence ? "red-400" : "green-400"}
                            textColor={permissions.hasPaymentEvidence ? "white" : "black"}
                            type="submit"
                            disabled={submitting || (permissions.hasPaymentEvidence && !notifyCustomer)}
                            className="admin-submit-btn"
                        />

                        {permissions.hasPaymentEvidence && (
                            <div style={{
                                fontSize: '0.8rem',
                                color: '#dc2626',
                                marginTop: '0.5rem',
                                textAlign: 'center',
                                fontFamily: 'IRANSans, Tahoma, Arial, sans-serif'
                            }}>
                                تغییرات در مرحله پس از پرداخت - نیاز به احتیاط بیشتر
                            </div>
                        )}
                    </div>
                )}

                {/* Show locked editing message for completely locked orders */}
                {permissions.completelyLocked && (
                    <div className="editing-blocked-message" style={{
                        backgroundColor: '#f3f4f6',
                        border: '2px solid #6b7280',
                        padding: '1rem',
                        borderRadius: '6px',
                        textAlign: 'center',
                        color: '#374151',
                        fontFamily: 'IRANSans, Tahoma, Arial, sans-serif',
                        marginTop: '1rem'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            🔒 ویرایش غیرفعال
                        </div>
                        <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                            {isPaymentUploaded
                                ? 'رسید پرداخت ارسال شده و معامله قطعی شده است.'
                                : 'این سفارش تکمیل شده است.'
                            }
                        </div>

                        {/* Future implementation instructions */}
                        <details style={{
                            backgroundColor: '#e5e7eb',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            textAlign: 'left',
                            direction: 'ltr'
                        }}>
                            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                Developer: Enable Future Editing
                            </summary>
                            <div style={{ marginTop: '0.5rem', lineHeight: '1.4' }}>
                                <p>To enable editing for {isPaymentUploaded ? 'payment_uploaded' : 'completed'} orders in the future:</p>
                                <code style={{
                                    display: 'block',
                                    backgroundColor: '#f3f4f6',
                                    padding: '0.5rem',
                                    borderRadius: '2px',
                                    marginTop: '0.5rem',
                                    fontFamily: 'monospace'
                                }}>
                                    {isPaymentUploaded
                                        ? 'FUTURE_FEATURES.ALLOW_POST_PAYMENT_EDIT = true'
                                        : 'FUTURE_FEATURES.ALLOW_COMPLETED_EDIT = true'
                                    }
                                </code>
                                <p style={{ marginTop: '0.5rem' }}>
                                    Located at the top of AdminPricingEditSection component.
                                    Consider adding proper authentication and audit logging.
                                </p>
                            </div>
                        </details>
                    </div>
                )}
            </form>
        </NeoBrutalistCard>
    );
};

export default AdminPricingEditSection;