import React, { useState, useEffect, useRef } from 'react';
import API from '../../../component/api';
import DealerAssignmentComponent from '../../../component/DealerAssignmentComponent';
import PaymentVerificationComponent from "./PaymentVerificationComponent";
import NeoBrutalistCard from '../../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from '../../../component/NeoBrutalist/NeoBrutalistInput';
import '../../../styles/component/AdminComponent/AdminOrderDetail.css';

const BusinessInvoiceTypeUpdate = ({ order, onUpdate }) => {
    const [newInvoiceType, setNewInvoiceType] = useState(order.business_invoice_type);
    const [updating, setUpdating] = useState(false);

    const getInvoiceTypeDisplay = (type) => {
        const typeMap = {
            'official': 'فاکتور رسمی',
            'unofficial': 'فاکتور غیررسمی'
        };
        return typeMap[type] || type;
    };

    const handleUpdateInvoiceType = async () => {
        if (newInvoiceType === order.business_invoice_type) {
            return;
        }

        setUpdating(true);
        try {
            const response = await API.post(`/orders/${order.id}/update-business-invoice-type/`, {
                business_invoice_type: newInvoiceType
            });

            if (response.status === 200) {
                // Display Persian success message
                alert(response.data.message);
                if (onUpdate) {
                    onUpdate();
                }
            }
        } catch (err) {
            console.error('❌ Error updating business invoice type:', err);

            // Show Persian error message from backend if available
            const errorMessage = err.response?.data?.error || 'خطا در به‌روزرسانی نوع فاکتور';
            alert(errorMessage);
        } finally {
            setUpdating(false);
        }
    };

    return (
        <NeoBrutalistCard className="admin-invoice-type-card" style={{ borderLeft: '6px solid #f59e0b' }}>
            <div className="admin-card-header">
                <h2 className="admin-card-title">تغییر نوع فاکتور</h2>
            </div>
            <div className="invoice-type-update-content">
                <div className="current-type" style={{ marginBottom: '1rem' }}>
                    <strong>نوع فعلی:</strong>
                    <span className={`invoice-type-display ${order.business_invoice_type}`}>
                        {order.business_invoice_type_display || getInvoiceTypeDisplay(order.business_invoice_type)}
                    </span>
                </div>

                <div className="invoice-type-selector" style={{ marginBottom: '1rem' }}>
                    <label>انتخاب نوع جدید:</label>
                    <select
                        value={newInvoiceType}
                        onChange={(e) => setNewInvoiceType(e.target.value)}
                        disabled={updating || order.status === 'completed'}
                        style={{
                            padding: '0.5rem',
                            border: '2px solid #000',
                            borderRadius: '4px',
                            backgroundColor: '#fff',
                            marginTop: '0.5rem',
                            width: '100%',
                            fontFamily: 'IRANSans, Tahoma, Arial, sans-serif' // Persian font support
                        }}
                    >
                        <option value="unofficial">فاکتور غیررسمی (بدون مالیات)</option>
                        <option value="official">فاکتور رسمی (با مالیات)</option>
                    </select>
                </div>

                {newInvoiceType !== order.business_invoice_type && (
                    <div className="update-actions">
                        <NeoBrutalistButton
                            text={updating ? "در حال به‌روزرسانی..." : "به‌روزرسانی نوع فاکتور"}
                            color="yellow-400"
                            textColor="black"
                            onClick={handleUpdateInvoiceType}
                            disabled={updating}
                        />
                    </div>
                )}

                {order.status === 'completed' && (
                    <div style={{
                        backgroundColor: '#fef3c7',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        color: '#92400e',
                        marginTop: '0.5rem',
                        fontFamily: 'IRANSans, Tahoma, Arial, sans-serif'
                    }}>
                        ⚠️ امکان تغییر نوع فاکتور برای سفارشات تکمیل شده وجود ندارد
                    </div>
                )}

                {order.status === 'cancelled' && (
                    <div style={{
                        backgroundColor: '#fee2e2',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        color: '#991b1b',
                        marginTop: '0.5rem',
                        fontFamily: 'IRANSans, Tahoma, Arial, sans-serif'
                    }}>
                        ⚠️ امکان تغییر نوع فاکتور برای سفارشات لغو شده وجود ندارد
                    </div>
                )}
            </div>
        </NeoBrutalistCard>
    );
};

const AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {
    const [order, setOrder] = useState(null);
    const [items, setItems] = useState([]);
    const [adminComment, setAdminComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [completing, setCompleting] = useState(false);
    const tableRef = useRef(null);


    useEffect(() => {
        if (orderId) {
            fetchOrder();
        }
    }, [orderId]);

    useEffect(() => {
        // Apply smart font sizing after component mounts
        if (order?.items && tableRef.current) {
            applySmartTextSizing();
        }
    }, [order]);

    const fetchOrder = async () => {
        setLoading(true);
        try {
            const res = await API.get(`/orders/${orderId}/`);

            setOrder(res.data);
            setItems(res.data.items || []);
            setAdminComment(res.data.admin_comment || '');
        } catch (err) {
            console.error('❌ Error fetching order:', err);
            setError('خطا در بارگیری سفارش');
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteOrder = async () => {
        if (!window.confirm('آیا مطمئن هستید که می‌خواهید این سفارش را تکمیل کنید؟')) {
            return;
        }

        setCompleting(true);
        setError('');

        try {
            const response = await API.post(`/orders/${orderId}/complete/`);

            if (response.status === 200) {
                alert('سفارش با موفقیت تکمیل شد!');

                // Update parent component
                if (onOrderUpdated) {
                    onOrderUpdated();
                }

                // Refresh order data
                fetchOrder();
            }

        } catch (err) {
            console.error('❌ Error completing order:', err);
            const errorMessage = err.response?.data?.error || 'خطا در تکمیل سفارش';
            setError(errorMessage);
        } finally {
            setCompleting(false);
        }
    };

    const handleRemoveDealer = async () => {
        if (!window.confirm('آیا مطمئن هستید که می‌خواهید نماینده را حذف کنید؟')) {
            return;
        }

        try {
            const response = await API.post(`/orders/${orderId}/remove-dealer/`);

            if (response.status === 200) {
                alert('نماینده با موفقیت حذف شد!');

                // Refresh order data
                fetchOrder();

                // Update parent component
                if (onOrderUpdated) {
                    onOrderUpdated();
                }
            }

        } catch (err) {
            console.error('❌ Error removing dealer:', err);
            const errorMessage = err.response?.data?.error || 'خطا در حذف نماینده';
            setError(errorMessage);
        }
    };

    // Smart text sizing function
    const applySmartTextSizing = () => {
        const productCells = tableRef.current?.querySelectorAll('.admin-table-cell:nth-child(1)');
        const notesCells = tableRef.current?.querySelectorAll('.admin-table-cell:nth-child(3)');

        productCells?.forEach(cell => {
            const textLength = cell.textContent.length;
            if (textLength > 30) {
                cell.style.fontSize = '0.7rem';
                cell.classList.add('text-overflow');
            } else if (textLength > 20) {
                cell.style.fontSize = '0.75rem';
            } else if (textLength > 15) {
                cell.style.fontSize = '0.8rem';
            }
        });

        notesCells?.forEach(cell => {
            const textLength = cell.textContent.length;
            if (textLength > 25) {
                cell.style.fontSize = '0.75rem';
                cell.classList.add('text-overflow');
            }
        });
    };



    // FIXED: Actually submit pricing to the API
    const handlePricingSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            // Validate items
            const hasValidItems = items.some(item =>
                item.quoted_unit_price && item.quoted_unit_price > 0 &&
                item.final_quantity && item.final_quantity > 0
            );

            if (!hasValidItems) {
                setError('لطفاً حداقل برای یک محصول قیمت و تعداد نهایی را وارد کنید');
                setSubmitting(false);
                return;
            }

            // Prepare data for submission
            const submissionData = {
                admin_comment: adminComment,
                items: items.map(item => ({
                    id: item.id,
                    quoted_unit_price: parseFloat(item.quoted_unit_price) || 0,
                    final_quantity: parseInt(item.final_quantity) || 0,
                    admin_notes: item.admin_notes || '',
                }))
            };

            console.log('📤 Submitting pricing data:', submissionData);

            // FIXED: Actually make the API call
            const response = await API.post(`/orders/${orderId}/submit_pricing/`, submissionData);

            if (response.status === 200) {
                console.log('✅ Pricing submission successful:', response.data);

                // Show success message
                alert('قیمت‌گذاری با موفقیت ثبت شد!');

                // Update parent component first
                if (onOrderUpdated) {
                    onOrderUpdated();
                }

                // Then refresh order data
                fetchOrder();
            }

        } catch (err) {
            console.error('❌ Error submitting pricing:', err);
            const errorMessage = err.response?.data?.error || 'خطا در به‌روزرسانی قیمت‌گذاری';
            setError(errorMessage);
        } finally {
            setSubmitting(false);
        }
    };

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending_pricing':
                return 'yellow-400';
            case 'waiting_customer_approval':
                return 'blue-400';
            case 'confirmed':
                return 'green-400';
            case 'payment_uploaded':
                return 'purple-400';
            case 'completed':
                return 'green-600';
            case 'rejected':
                return 'red-400';
            case 'cancelled':
                return 'gray-400';
            default:
                return 'gray-400';
        }
    };

    const formatStatus = (status) => {
        const statusMap = {
            'pending_pricing': 'در انتظار قیمت‌گذاری',
            'waiting_customer_approval': 'در انتظار تأیید مشتری',
            'confirmed': 'تأیید شده',
            'payment_uploaded': 'رسید پرداخت آپلود شده',
            'completed': 'تکمیل شده',
            'rejected': 'رد شده',
            'cancelled': 'لغو شده'
        };
        return statusMap[status] || status;
    };


    const formatQuantity = (quantity) => {
        if (!quantity || quantity === 0) return '';
        return new Intl.NumberFormat('fa-IR').format(quantity);
    };

    const calculateTotal = (unitPrice, quantity) => {
        if (!unitPrice || !quantity || unitPrice === 0 || quantity === 0) {
            return 'در انتظار';
        }
        const total = parseFloat(unitPrice) * parseInt(quantity);
        const formattedTotal = new Intl.NumberFormat('fa-IR').format(total);
        return `${formattedTotal} ریال`;
    };

    const calculateOrderTotal = () => {
        const total = items.reduce((sum, item) => {
            if (item.quoted_unit_price && item.final_quantity) {
                return sum + (parseFloat(item.quoted_unit_price) * parseInt(item.final_quantity));
            }
            return sum;
        }, 0);

        if (total > 0) {
            return new Intl.NumberFormat('fa-IR').format(total);
        }
        return 'محاسبه نشده';
    };

    if (loading) {
        return (
            <div className="admin-order-detail">
                <NeoBrutalistCard className="admin-loading-card">
                    <div className="admin-loading-content">
                        <span>🔄</span>
                        <span className="admin-loading-text">در حال بارگذاری سفارش...</span>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    if (error && !order) {
        return (
            <div className="admin-order-detail">
                <NeoBrutalistCard className="admin-error-card">
                    <div className="admin-error-content">
                        <span className="admin-error-icon">⚠️</span>
                        <span className="admin-error-text">{error}</span>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="admin-order-detail">
                <NeoBrutalistCard className="admin-error-card">
                    <div className="admin-error-content">
                        <span className="admin-error-icon">❌</span>
                        <span className="admin-error-text">سفارش پیدا نشد</span>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    return (
        <div className="admin-order-detail" dir="rtl">
            {/* Header */}
            <div className="admin-order-header">
                <h1 className="admin-order-title">ویرایش سفارش #{order.id}</h1>
                <NeoBrutalistButton
                    text={formatStatus(order.status)}
                    color={getStatusColor(order.status)}
                    textColor="black"
                    className="admin-status-badge"
                />
            </div>

            {error && (
                <div className="admin-status-message admin-error">
                    <span className="admin-status-icon">⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {/* Order Information */}
            <NeoBrutalistCard className="admin-order-info-card">
                <div className="admin-card-header">
                    <h2 className="admin-card-title">اطلاعات سفارش</h2>
                </div>
                <div className="admin-order-info-grid">
                    <div className="admin-info-item">
                        <span className="admin-info-label">مشتری</span>
                        <span className="admin-info-value">{order.customer_name}</span>
                    </div>
                    <div className="admin-info-item">
                        <span className="admin-info-label">شماره تماس</span>
                        <span className="admin-info-value">
                            {order.customer_phone || 'ثبت نشده'}
                        </span>
                    </div>
                    <div className="admin-info-item">
                        <span className="admin-info-label">تاریخ ایجاد</span>
                        <span className="admin-info-value">
                            {new Date(order.created_at).toLocaleDateString('fa-IR')}
                        </span>
                    </div>
                    <div className="admin-info-item">
                        <span className="admin-info-label">وضعیت</span>
                        <span className="admin-info-value">{formatStatus(order.status)}</span>
                    </div>

                    <div className="admin-info-item">
                        <span className="admin-info-label">نوع فاکتور</span>
                        <span className="admin-info-value">
                        {order.business_invoice_type_display ||
                            (order.business_invoice_type === 'official' ? 'فاکتور رسمی' : 'فاکتور غیررسمی')}
                    </span>
                    </div>

                    <div className="admin-info-item">
                        <span className="admin-info-label">توضیحات مشتری</span>
                        <span className="admin-info-value">
                            {order.customer_comment || 'هیچ توضیحی ارائه نشده'}
                        </span>
                    </div>
                    <div className="admin-info-item">
                        <span className="admin-info-label">مجموع سفارش</span>
                        <span className="admin-info-value">
                            {calculateOrderTotal()} ریال
                        </span>
                    </div>



                    {/* Show completion info for completed orders */}
                    {order.status === 'completed' && order.completion_date && (
                        <div className="admin-info-item">
                            <span className="admin-info-label">تاریخ تکمیل</span>
                            <span className="admin-info-value">
                                {new Date(order.completion_date).toLocaleDateString('fa-IR')}
                            </span>
                        </div>
                    )}
                </div>
            </NeoBrutalistCard>

            <BusinessInvoiceTypeUpdate
                order={order}
                onUpdate={fetchOrder}
            />

            {/* Dealer Assignment Section */}
            <NeoBrutalistCard className="admin-dealer-assignment-card">
                <div className="admin-card-header">
                    <h2 className="admin-card-title">تخصیص نماینده فروش</h2>
                </div>

                <div className="dealer-assignment-section">
                    {order.assigned_dealer_name ? (
                        <div className="current-dealer">
                            <div className="admin-info-item">
                                <span className="admin-info-label">نماینده فعلی:</span>
                                <span className="admin-info-value">{order.assigned_dealer_name}</span>
                            </div>
                            <div className="admin-info-item">
                                <span className="admin-info-label">تاریخ تخصیص:</span>
                                <span className="admin-info-value">
                                    {order.dealer_assigned_at && new Date(order.dealer_assigned_at).toLocaleDateString('fa-IR')}
                                </span>
                            </div>
                            <NeoBrutalistButton
                                text="حذف نماینده"
                                color="red-400"
                                textColor="white"
                                onClick={handleRemoveDealer}
                                className="remove-dealer-btn"
                            />
                        </div>
                    ) : (
                        <div className="assign-dealer">
                            <DealerAssignmentComponent
                                orderId={order.id}
                                onDealerAssigned={fetchOrder}
                            />
                        </div>
                    )}

                    {order.dealer_notes && (
                        <div className="dealer-notes">
                            <div className="admin-info-item">
                                <span className="admin-info-label">یادداشت‌های نماینده:</span>
                                <span className="admin-info-value">{order.dealer_notes}</span>
                            </div>
                        </div>
                    )}
                </div>
            </NeoBrutalistCard>

            {/* Pricing Form */}
            <NeoBrutalistCard className="admin-pricing-card">
                <div className="admin-card-header">
                    <h2 className="admin-card-title">قیمت‌گذاری و جزئیات</h2>
                </div>

                <form className="admin-pricing-form" onSubmit={handlePricingSubmit}>
                    {/* Admin Comment */}
                    <div className="admin-comment-section">
                        <h3 className="admin-comment-title">نظر مدیر</h3>
                        <textarea
                            className="admin-comment-textarea"
                            value={adminComment}
                            onChange={e => setAdminComment(e.target.value)}
                            placeholder="نظرات و توضیحات مدیر برای این سفارش..."
                            rows={4}
                            disabled={order.status !== 'pending_pricing'}
                        />
                    </div>

                    {/* Items Table */}
                    <div className="admin-items-section">
                        <h3 className="admin-section-title">محصولات</h3>
                        <div className="admin-items-table" ref={tableRef}>
                            <div className="admin-table-header">
                                <div className="admin-header-cell">نام محصول</div>
                                <div className="admin-header-cell">تعداد درخواستی</div>
                                <div className="admin-header-cell">نظر مشتری</div>
                                <div className="admin-header-cell">قیمت واحد (ریال)</div>
                                <div className="admin-header-cell">تعداد نهایی</div>
                                <div className="admin-header-cell">نظر مدیر</div>
                                <div className="admin-header-cell">جمع کل</div>
                            </div>

                            {items.map((item, idx) => (
                                <div key={item.id} className="admin-table-row">
                                    <div className="admin-table-cell admin-product-name" title={item.product_name}>
                                        {item.product_name}
                                    </div>
                                    <div className="admin-table-cell">
                                        {formatQuantity(item.requested_quantity)}
                                    </div>
                                    <div className="admin-table-cell admin-customer-notes" title={item.customer_notes}>
                                        {item.customer_notes || '-'}
                                    </div>
                                    <div className="admin-table-cell admin-input-cell">
                                        <NeoBrutalistInput
                                            type="number"
                                            value={item.quoted_unit_price || ''}
                                            onChange={e => updateItem(idx, 'quoted_unit_price', e.target.value)}
                                            placeholder="قیمت"
                                            min="0"
                                            step="1000"
                                            disabled={order.status !== 'pending_pricing'}
                                        />
                                    </div>
                                    <div className="admin-table-cell admin-input-cell">
                                        <NeoBrutalistInput
                                            type="number"
                                            value={item.final_quantity || ''}
                                            onChange={e => updateItem(idx, 'final_quantity', e.target.value)}
                                            placeholder="تعداد"
                                            min="0"
                                            disabled={order.status !== 'pending_pricing'}
                                        />
                                    </div>
                                    <div className="admin-table-cell admin-input-cell">
                                        <NeoBrutalistInput
                                            type="text"
                                            value={item.admin_notes || ''}
                                            onChange={e => updateItem(idx, 'admin_notes', e.target.value)}
                                            placeholder="نظر مدیر"
                                            disabled={order.status !== 'pending_pricing'}
                                        />
                                    </div>
                                    <div className="admin-table-cell admin-total-cell">
                                        {calculateTotal(item.quoted_unit_price, item.final_quantity)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Submit Section */}
                    <div className="admin-submit-section">
                        {order.status === 'pending_pricing' && (
                            <NeoBrutalistButton
                                text={submitting ? "در حال ارسال..." : "ثبت قیمت‌گذاری"}
                                color="yellow-400"
                                textColor="black"
                                type="submit"
                                disabled={submitting}
                                className="admin-submit-btn"
                            />
                        )}
                    </div>
                </form>
            </NeoBrutalistCard>

            {/* Payment Verification Section */}
            {(order.status === 'payment_uploaded') && (
                <NeoBrutalistCard className="admin-payment-verification-card">
                    <div className="admin-card-header">
                        <h2 className="admin-card-title">تایید پرداخت</h2>
                    </div>
                    <PaymentVerificationComponent
                        orderId={order.id}
                        order={order}
                        onPaymentVerified={fetchOrder}
                    />
                </NeoBrutalistCard>
            )}

            {/* Complete Order Section */}
            {(order.status === 'confirmed') && (
                <NeoBrutalistCard className="admin-complete-order-card">
                    <div className="admin-card-header">
                        <h2 className="admin-card-title">تکمیل سفارش</h2>
                    </div>
                    <div className="admin-complete-section">
                        <p className="admin-complete-description">
                            سفارش آماده تکمیل است. آیا مایل به تکمیل این سفارش هستید؟
                        </p>
                        <NeoBrutalistButton
                            text={completing ? "در حال تکمیل..." : "تکمیل سفارش"}
                            color="green-400"
                            textColor="black"
                            onClick={handleCompleteOrder}
                            disabled={completing}
                            className="admin-complete-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Success Message */}
            {!error && (submitting || completing) && (
                <div className="admin-status-message admin-success">
                    <span className="admin-status-icon">✅</span>
                    <span>
                        {submitting && "قیمت‌گذاری در حال ثبت..."}
                        {completing && "سفارش در حال تکمیل..."}
                    </span>
                </div>
            )}

            {/* Payment Information Display */}
            {(order.status === 'payment_uploaded' || order.status === 'confirmed' || order.status === 'completed') && (
                <NeoBrutalistCard className="admin-order-info-card">
                    <div className="admin-card-header">
                        <h2 className="admin-card-title">اطلاعات پرداخت</h2>
                    </div>
                    <div className="admin-order-info-grid">
                        {order.has_payment_receipts ? (
                            <>
                                <div className="admin-info-item">
                                    <span className="admin-info-label">نوع پرداخت</span>
                                    <span className="admin-info-value">رسیدهای متعدد</span>
                                </div>
                                <div className="admin-info-item">
                                    <span className="admin-info-label">تعداد رسیدها</span>
                                    <span className="admin-info-value">{order.payment_receipts_count || 'نامشخص'}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                {order.payment_receipt_uploaded_at && (
                                    <div className="admin-info-item">
                                        <span className="admin-info-label">تاریخ آپلود رسید</span>
                                        <span className="admin-info-value">
                                            {new Date(order.payment_receipt_uploaded_at).toLocaleDateString('fa-IR')}
                                        </span>
                                    </div>
                                )}
                                {order.payment_verified_at && (
                                    <div className="admin-info-item">
                                        <span className="admin-info-label">تاریخ تایید پرداخت</span>
                                        <span className="admin-info-value">
                                            {new Date(order.payment_verified_at).toLocaleDateString('fa-IR')}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}

                        {order.payment_notes && (
                            <div className="admin-info-item">
                                <span className="admin-info-label">یادداشت‌های پرداخت</span>
                                <span className="admin-info-value">{order.payment_notes}</span>
                            </div>
                        )}
                    </div>

                    {/* Show legacy single receipt if exists */}
                    {order.payment_receipt && !order.has_payment_receipts && (
                        <div className="payment-receipt-view">
                            <h4>رسید پرداخت:</h4>
                            <img
                                src={order.payment_receipt}
                                alt="رسید پرداخت"
                                className="admin-receipt-image"
                                onClick={() => window.open(order.payment_receipt, '_blank')}
                                style={{
                                    maxWidth: '300px',
                                    maxHeight: '400px',
                                    cursor: 'pointer',
                                    border: '2px solid #000',
                                    borderRadius: '8px'
                                }}
                            />
                        </div>
                    )}
                </NeoBrutalistCard>
            )}
        </div>
    );
};

export default AdminOrderDetailPage;