import React, { useState, useEffect, useRef } from 'react';
import API from '../component/api';
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
            setError('خطا در بارگیری سفارش');
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteOrder = async () => {
        try {
            if (onOrderUpdated) onOrderUpdated();
        } catch (err) {
            setError('Error competeing the order');
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
                item.quoted_unit_price && item.final_quantity
            );

            if (!hasValidItems) {
                setError('لطفاً حداقل برای یک محصول قیمت و تعداد نهایی را وارد کنید');
                setSubmitting(false);
                return;
            }

            await API.post(`/orders/${orderId}/submit_pricing/`, {
                admin_comment: adminComment,
                items: items.map(i => ({
                    id: i.id,
                    quoted_unit_price: Number(i.quoted_unit_price) || 0,
                    final_quantity: Number(i.final_quantity) || 0,
                    admin_notes: i.admin_notes || '',
                }))
            });

            if (onOrderUpdated) {
                onOrderUpdated();
            }
        } catch (err) {
            setError(err.response?.data?.error || 'خطا در به‌روزرسانی قیمت‌گذاری');
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
            'completed':'تکمیل شده',
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
        const total = unitPrice * quantity;
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
                                        />
                                    </div>
                                    <div className="admin-table-cell admin-input-cell">
                                        <NeoBrutalistInput
                                            type="number"
                                            value={item.final_quantity || ''}
                                            onChange={e => updateItem(idx, 'final_quantity', e.target.value)}
                                            placeholder="تعداد"
                                            min="0"
                                        />
                                    </div>
                                    <div className="admin-table-cell admin-input-cell">
                                        <NeoBrutalistInput
                                            type="text"
                                            value={item.admin_notes || ''}
                                            onChange={e => updateItem(idx, 'admin_notes', e.target.value)}
                                            placeholder="نظر مدیر"
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
                        <NeoBrutalistButton
                            text={submitting ? "در حال ارسال..." : "ثبت قیمت‌گذاری"}
                            color="yellow-400"
                            textColor="black"
                            type="submit"
                            disabled={submitting}
                            className="admin-submit-btn"
                        />

                        {order.status === 'confirmed' && (
                            <NeoBrutalistButton
                                text="تکمیل سفارش"
                                color="green-400"
                                textColor="black"
                                onClick={handleCompleteOrder}
                                className="complete-order-btn"
                            />
                        )}
                    </div>
                </form>
            </NeoBrutalistCard>

            {/* Success Message */}
            {!error && submitting && (
                <div className="admin-status-message admin-success">
                    <span className="admin-status-icon">✅</span>
                    <span>قیمت‌گذاری با موفقیت ثبت شد!</span>
                </div>
            )}
        </div>
    );
};

export default AdminOrderDetailPage;