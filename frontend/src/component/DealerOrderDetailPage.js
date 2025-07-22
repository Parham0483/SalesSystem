// frontend/src/component/DealerOrderDetailPage.js - Dealer-specific order view
import React, { useState, useEffect, useRef } from 'react';
import API from './api';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import '../styles/component/OrderDetail.css';

const DealerOrderDetailPage = ({ orderId, onOrderUpdated }) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dealerNotes, setDealerNotes] = useState('');
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [submittingNotes, setSubmittingNotes] = useState(false);
    const tableRef = useRef(null);

    useEffect(() => {
        if (orderId) {
            fetchOrder();
        }
    }, [orderId]);

    useEffect(() => {
        if (order?.items && tableRef.current) {
            applySmartTextSizing();
        }
    }, [order]);

    const fetchOrder = async () => {
        setLoading(true);
        try {
            const response = await API.get(`/orders/${orderId}/`);
            console.log('📦 Dealer viewing order:', response.data);
            setOrder(response.data);
            setDealerNotes(response.data.dealer_notes || '');
        } catch (err) {
            console.error('❌ Error fetching order:', err);
            setError('خطا در بارگیری جزئیات سفارش');
        } finally {
            setLoading(false);
        }
    };

    const applySmartTextSizing = () => {
        const productCells = tableRef.current?.querySelectorAll('.neo-table-cell:nth-child(1)');
        const notesCells = tableRef.current?.querySelectorAll('.neo-table-cell:nth-child(3)');

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

    const handleUpdateDealerNotes = async () => {
        setSubmittingNotes(true);
        setError('');

        try {
            const response = await API.post(`/orders/${orderId}/update-dealer-notes/`, {
                dealer_notes: dealerNotes
            });

            console.log('✅ Dealer notes updated:', response.data);
            alert('یادداشت‌های نماینده با موفقیت به‌روزرسانی شد');
            setIsEditingNotes(false);

            if (onOrderUpdated) {
                onOrderUpdated();
            }

            fetchOrder();

        } catch (err) {
            console.error('❌ Error updating dealer notes:', err);
            setError('خطا در به‌روزرسانی یادداشت‌ها');
        } finally {
            setSubmittingNotes(false);
        }
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

    const formatPrice = (price) => {
        if (!price || price === 0) return 'در انتظار';
        const formattedNumber = new Intl.NumberFormat('fa-IR').format(price);
        return `${formattedNumber} ریال`;
    };

    const formatQuantity = (quantity) => {
        if (!quantity || quantity === 0) return 'در انتظار';
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

    const truncateText = (text, maxLength = 30) => {
        if (!text) return '-';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    if (loading) {
        return (
            <div className="neo-order-detail">
                <NeoBrutalistCard className="neo-loading-card">
                    <div className="neo-loading-content">
                        <span>🔄</span>
                        <span className="neo-loading-text">در حال بارگذاری جزئیات سفارش...</span>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    if (error && !order) {
        return (
            <div className="neo-order-detail">
                <NeoBrutalistCard className="neo-error-card">
                    <div className="neo-error-content">
                        <span className="neo-error-icon">⚠️</span>
                        <span className="neo-error-text">{error}</span>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="neo-order-detail">
                <NeoBrutalistCard className="neo-error-card">
                    <div className="neo-error-content">
                        <span className="neo-error-icon">❌</span>
                        <span className="neo-error-text">سفارش پیدا نشد</span>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    return (
        <div className="neo-order-detail" dir="rtl">
            {/* Header */}
            <div className="neo-order-header">
                <h1 className="neo-order-title">🏢 نمای نماینده - سفارش #{order.id}</h1>
                <NeoBrutalistButton
                    text={formatStatus(order.status)}
                    color={getStatusColor(order.status)}
                    textColor="black"
                    className="neo-status-badge"
                />
            </div>

            {error && (
                <div className="neo-status-message neo-error">
                    <span className="neo-status-icon">⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {/* Customer Information */}
            <NeoBrutalistCard className="neo-order-info-card" style={{ borderLeft: '6px solid #8b5cf6' }}>
                <div className="neo-card-header">
                    <h2 className="neo-card-title">👤 اطلاعات مشتری</h2>
                </div>
                <div className="neo-order-info-grid">
                    <div className="neo-info-item">
                        <span className="neo-info-label">نام مشتری</span>
                        <span className="neo-info-value">{order.customer_name}</span>
                    </div>
                    <div className="neo-info-item">
                        <span className="neo-info-label">تاریخ ثبت سفارش</span>
                        <span className="neo-info-value">
                            {new Date(order.created_at).toLocaleDateString('fa-IR')}
                        </span>
                    </div>
                    <div className="neo-info-item">
                        <span className="neo-info-label">وضعیت سفارش</span>
                        <span className="neo-info-value">{formatStatus(order.status)}</span>
                    </div>
                    {order.customer_comment && (
                        <div className="neo-info-item neo-full-width">
                            <span className="neo-info-label">درخواست مشتری</span>
                            <span className="neo-info-value">{order.customer_comment}</span>
                        </div>
                    )}
                </div>
            </NeoBrutalistCard>

            {/* Pricing Information */}
            {order.priced_by_name && (
                <NeoBrutalistCard className="neo-order-info-card" style={{ borderLeft: '6px solid #0284c7' }}>
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">💼 اطلاعات قیمت‌گذاری</h2>
                    </div>
                    <div className="neo-order-info-grid">
                        <div className="neo-info-item">
                            <span className="neo-info-label">قیمت‌گذاری توسط</span>
                            <span className="neo-info-value">{order.priced_by_name}</span>
                        </div>
                        {order.priced_by_email && (
                            <div className="neo-info-item">
                                <span className="neo-info-label">ایمیل قیمت‌گذار</span>
                                <span className="neo-info-value">{order.priced_by_email}</span>
                            </div>
                        )}
                        <div className="neo-info-item">
                            <span className="neo-info-label">تاریخ قیمت‌گذاری</span>
                            <span className="neo-info-value">
                                {order.pricing_date
                                    ? new Date(order.pricing_date).toLocaleDateString('fa-IR')
                                    : 'هنوز قیمت‌گذاری نشده'
                                }
                            </span>
                        </div>
                        {order.quoted_total > 0 && (
                            <div className="neo-info-item">
                                <span className="neo-info-label">مبلغ کل سفارش</span>
                                <span className="neo-info-value neo-payable-amount">
                                    {formatPrice(order.quoted_total)}
                                </span>
                            </div>
                        )}
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Commission Information */}
            {order.effective_commission_rate > 0 && (
                <NeoBrutalistCard className="neo-order-info-card" style={{ borderLeft: '6px solid #16a34a' }}>
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">💰 اطلاعات کمیسیون</h2>
                    </div>
                    <div className="neo-order-info-grid">
                        <div className="neo-info-item">
                            <span className="neo-info-label">نرخ کمیسیون</span>
                            <span className="neo-info-value" style={{ color: '#16a34a', fontWeight: 'bold' }}>
                                {order.effective_commission_rate}%
                                {order.has_custom_commission && (
                                    <span style={{
                                        fontSize: '0.8rem',
                                        color: '#dc2626',
                                        marginRight: '0.5rem'
                                    }}>
                                        (نرخ سفارشی)
                                    </span>
                                )}
                            </span>
                        </div>
                        {order.dealer_default_rate && order.has_custom_commission && (
                            <div className="neo-info-item">
                                <span className="neo-info-label">نرخ پیش‌فرض شما</span>
                                <span className="neo-info-value">{order.dealer_default_rate}%</span>
                            </div>
                        )}
                        {order.dealer_commission_amount > 0 && (
                            <div className="neo-info-item">
                                <span className="neo-info-label">مبلغ کمیسیون</span>
                                <span className="neo-info-value" style={{
                                    color: '#16a34a',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem'
                                }}>
                                    {formatPrice(order.dealer_commission_amount)}
                                </span>
                            </div>
                        )}
                        <div className="neo-info-item">
                            <span className="neo-info-label">تاریخ تخصیص</span>
                            <span className="neo-info-value">
                                {order.dealer_assigned_at
                                    ? new Date(order.dealer_assigned_at).toLocaleDateString('fa-IR')
                                    : 'نامشخص'
                                }
                            </span>
                        </div>
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Order Items */}
            <NeoBrutalistCard className="neo-items-card">
                <div className="neo-card-header">
                    <h2 className="neo-card-title">📦 اقلام سفارش</h2>
                </div>
                <div className="neo-items-table" ref={tableRef}>
                    <div className="neo-table-header">
                        <div className="neo-header-cell">نام محصول</div>
                        <div className="neo-header-cell">تعداد درخواستی</div>
                        <div className="neo-header-cell">یادداشت مشتری</div>
                        <div className="neo-header-cell">قیمت واحد</div>
                        <div className="neo-header-cell">تعداد نهایی</div>
                        <div className="neo-header-cell">مبلغ کل</div>
                    </div>
                    {order.items?.map((item, index) => (
                        <div key={index} className="neo-table-row">
                            <div
                                className="neo-table-cell"
                                title={item.product_name}
                                data-pending={!item.product_name}
                            >
                                {item.product_name || 'نامشخص'}
                            </div>
                            <div className="neo-table-cell">
                                {formatQuantity(item.requested_quantity)}
                            </div>
                            <div
                                className="neo-table-cell"
                                title={item.customer_notes}
                                data-pending={!item.customer_notes}
                            >
                                {truncateText(item.customer_notes) || '-'}
                            </div>
                            <div
                                className="neo-table-cell"
                                data-pending={!item.quoted_unit_price}
                            >
                                {formatPrice(item.quoted_unit_price)}
                            </div>
                            <div
                                className="neo-table-cell"
                                data-pending={!item.final_quantity}
                            >
                                {formatQuantity(item.final_quantity)}
                            </div>
                            <div
                                className="neo-table-cell"
                                data-pending={!item.quoted_unit_price || !item.final_quantity}
                            >
                                {calculateTotal(item.quoted_unit_price, item.final_quantity)}
                            </div>
                        </div>
                    ))}
                </div>
            </NeoBrutalistCard>

            {/* Dealer Notes Section */}
            <NeoBrutalistCard className="neo-notes-card" style={{ borderLeft: '6px solid #f59e0b' }}>
                <div className="neo-card-header">
                    <h2 className="neo-card-title">📝 یادداشت‌های نماینده</h2>
                    <NeoBrutalistButton
                        text={isEditingNotes ? "لغو" : "ویرایش"}
                        color={isEditingNotes ? "red-400" : "blue-400"}
                        textColor="white"
                        onClick={() => {
                            setIsEditingNotes(!isEditingNotes);
                            if (isEditingNotes) {
                                setDealerNotes(order.dealer_notes || '');
                            }
                        }}
                        className="neo-edit-btn"
                    />
                </div>
                <div className="neo-notes-content">
                    {isEditingNotes ? (
                        <div className="neo-notes-editing">
                            <NeoBrutalistInput
                                type="textarea"
                                value={dealerNotes}
                                onChange={(e) => setDealerNotes(e.target.value)}
                                placeholder="یادداشت‌های شما در مورد این سفارش..."
                                rows={4}
                                className="neo-dealer-notes-input"
                            />
                            <div className="neo-notes-actions">
                                <NeoBrutalistButton
                                    text="ذخیره"
                                    color="green-400"
                                    textColor="white"
                                    onClick={handleUpdateDealerNotes}
                                    disabled={submittingNotes}
                                    className="neo-save-btn"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="neo-notes-display">
                            <p className="neo-notes-text">
                                {order.dealer_notes || 'هنوز یادداشتی ثبت نشده است.'}
                            </p>
                        </div>
                    )}
                </div>
            </NeoBrutalistCard>

            {/* Order Summary */}
            {order.quoted_total > 0 && (
                <NeoBrutalistCard className="neo-summary-card" style={{ borderLeft: '6px solid #dc2626' }}>
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">💼 خلاصه مالی</h2>
                    </div>
                    <div className="neo-summary-content">
                        <div className="neo-summary-row">
                            <span className="neo-summary-label">مبلغ کل سفارش:</span>
                            <span className="neo-summary-value neo-total-amount">
                                {formatPrice(order.quoted_total)}
                            </span>
                        </div>
                        {order.dealer_commission_amount > 0 && (
                            <div className="neo-summary-row">
                                <span className="neo-summary-label">کمیسیون شما ({order.effective_commission_rate}%):</span>
                                <span className="neo-summary-value neo-commission-amount">
                                    {formatPrice(order.dealer_commission_amount)}
                                </span>
                            </div>
                        )}
                    </div>
                </NeoBrutalistCard>
            )}
        </div>
    );
};

export default DealerOrderDetailPage;