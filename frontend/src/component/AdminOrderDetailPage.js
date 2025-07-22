import React, { useState, useEffect, useRef } from 'react';
import API from '../component/api';
import DealerAssignmentComponent from './DealerAssignmentComponent';
import NeoBrutalistCard from '../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from '../component/NeoBrutalist/NeoBrutalistInput';
import '../styles/AdminOrderDetail.css';

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
            console.log('📦 Order data received:', res.data);
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
            console.log('🔄 Completing order:', orderId);

            const response = await API.post(`/orders/${orderId}/complete/`);

            console.log('✅ Order completed successfully:', response.data);

            // Show success message
            alert('سفارش با موفقیت تکمیل شد!');

            // Update parent component
            if (onOrderUpdated) {
                onOrderUpdated();
            }

            // Refresh order data
            fetchOrder();

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

            console.log('✅ Dealer removed successfully:', response.data);
            alert('نماینده با موفقیت حذف شد!');

            // Refresh order data
            fetchOrder();

            // Update parent component
            if (onOrderUpdated) {
                onOrderUpdated();
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

            const response = await API.post(`/orders/${orderId}/submit_pricing/`, submissionData);

            console.log('✅ Pricing submitted successfully:', response.data);

            // Show success message
            alert('قیمت‌گذاری با موفقیت ثبت شد!');

            if (onOrderUpdated) {
                onOrderUpdated();
            }

            // Refresh order data
            fetchOrder();

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
            'completed': 'تکمیل شده',
            'rejected': 'رد شده',
            'cancelled': 'لغو شده'
        };
        return statusMap[status] || status;
    };

    // Helper functions with Persian formatting
    const formatPrice = (price) => {
        if (!price || price === 0) return '';
        const formattedNumber = new Intl.NumberFormat('fa-IR').format(price);
        return formattedNumber;
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
                        <span className="admin-info-label">توضیحات مشتری</span>
                        <span className="admin-info-value">
                            {order.customer_comment || 'هیچ توضیحی ارائه نشده'}
                        </span>
                    </div>

                    {/* Show completion info for completed orders */}
                    {order.status === 'completed' && order.completion_date && (
                        <>
                            <div className="admin-info-item">
                                <span className="admin-info-label">تاریخ تکمیل</span>
                                <span className="admin-info-value">
                                    {new Date(order.completion_date).toLocaleDateString('fa-IR')}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </NeoBrutalistCard>

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

                        {order.status === 'confirmed' && (
                            <NeoBrutalistButton
                                text={completing ? "در حال تکمیل..." : "تکمیل سفارش"}
                                color="green-400"
                                textColor="black"
                                onClick={handleCompleteOrder}
                                disabled={completing}
                                className="complete-order-btn"
                            />
                        )}
                    </div>
                </form>
            </NeoBrutalistCard>

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

            {/* Order Status Info */}
            {order.status === 'waiting_customer_approval' && (
                <NeoBrutalistCard className="admin-order-info-card">
                    <div className="admin-card-header">
                        <h2 className="admin-card-title">⏰ منتظر پاسخ مشتری</h2>
                    </div>
                    <div className="admin-order-info-grid">
                        <div className="admin-info-item">
                            <span className="admin-info-label">قیمت‌گذاری انجام شده</span>
                            <span className="admin-info-value">
                                {order.pricing_date && new Date(order.pricing_date).toLocaleDateString('fa-IR')}
                            </span>
                        </div>
                        <div className="admin-info-item">
                            <span className="admin-info-label">مبلغ کل ارائه شده</span>
                            <span className="admin-info-value">
                                {formatPrice(order.quoted_total)} ریال
                            </span>
                        </div>
                    </div>
                </NeoBrutalistCard>
            )}

            {order.status === 'completed' && (
                <NeoBrutalistCard className="admin-order-info-card">
                    <div className="admin-card-header">
                        <h2 className="admin-card-title">✅ سفارش تکمیل شده</h2>
                    </div>
                    <div className="admin-order-info-grid">
                        <div className="admin-info-item">
                            <span className="admin-info-label">تاریخ تکمیل</span>
                            <span className="admin-info-value">
                                {order.completion_date && new Date(order.completion_date).toLocaleDateString('fa-IR')}
                            </span>
                        </div>
                        <div className="admin-info-item">
                            <span className="admin-info-label">مبلغ نهایی</span>
                            <span className="admin-info-value">
                                {formatPrice(order.quoted_total)} ریال
                            </span>
                        </div>
                        {order.invoice_number && (
                            <div className="admin-info-item">
                                <span className="admin-info-label">شماره فاکتور</span>
                                <span className="admin-info-value">{order.invoice_number}</span>
                            </div>
                        )}
                    </div>
                </NeoBrutalistCard>
            )}
        </div>
    );
};

export default AdminOrderDetailPage;