import React, { useState, useEffect, useRef } from 'react';
import API from './api';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import '../styles/OrderDetail.css';

const OrderDetailPage = ({ orderId, onOrderUpdated }) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedComment, setEditedComment] = useState('');
    const [approvalDecision, setApprovalDecision] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [generatingInvoice, setGeneratingInvoice] = useState(false);
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
            setOrder(response.data);
            setEditedComment(response.data.customer_comment || '');
        } catch (err) {
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

    const handleApprovalSubmit = async () => {
        if (!approvalDecision) {
            setError('لطفا تایید یا رد را انتخاب کنید');
            return;
        }

        if (approvalDecision === 'reject' && !rejectionReason.trim()) {
            setError('لطفا دلیل رد را ذکر کنید');
            return;
        }

        setSubmitting(true);
        try {
            if (approvalDecision === 'approve') {
                // First approve the order
                await API.post(`/orders/${orderId}/approve/`);
            } else {
                await API.post(`/orders/${orderId}/reject/`, {
                    rejection_reason: rejectionReason
                });
            }

            if (onOrderUpdated) {
                onOrderUpdated();
            } else {
                fetchOrder();
            }
        } catch (err) {
            setError(err.response?.data?.error || 'خطا در ارسال تصمیم');
            setGeneratingInvoice(false);
        } finally {
            setSubmitting(false);
        }
    };

    const downloadInvoice = async () => {
        try {
            if (!order.invoice_id) {
                setError('فاکتور هنوز ایجاد نشده است');
                return;
            }

            const response = await API.get(`/invoices/${order.invoice_id}/download-pdf/`, {
                responseType: 'blob'
            });

            // Create blob URL and download
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice_${order.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError('خطا در دانلود فاکتور');
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
            'waiting_customer_approval': 'در انتظار تأیید',
            'confirmed': 'تأیید شده و فاکتور صادر شد',
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
                <h1 className="neo-order-title">سفارش #{order.id}</h1>
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

            {/* Order Information dfakfnaks;c;askcna;sknc*/}
            <NeoBrutalistCard className="neo-order-info-card">
                <div className="neo-card-header">
                    <h2 className="neo-card-title">اطلاعات سفارش</h2>
                </div>
                <div className="neo-order-info-grid">
                    <div className="neo-info-item">
                        <span className="neo-info-label">مشتری</span>
                        <span className="neo-info-value">{order.customer_name}</span>
                    </div>
                    <div className="neo-info-item">
                        <span className="neo-info-label">تاریخ ایجاد</span>
                        <span className="neo-info-value">
                            {new Date(order.created_at).toLocaleDateString('fa-IR')}
                        </span>
                    </div>
                    <div className="neo-info-item">
                        <span className="neo-info-label">وضعیت</span>
                        <span className="neo-info-value">{formatStatus(order.status)}</span>
                    </div>
                    {order.quoted_total > 0 && (
                        <div className="neo-info-item">
                            <span className="neo-info-label">مبلغ کل</span>
                            <span className="neo-info-value neo-payable-amount">
                                {formatPrice(order.quoted_total)}
                            </span>
                        </div>
                    )}
                    {order.invoice_number && (
                        <div className="neo-info-item">
                            <span className="neo-info-label">شماره فاکتور</span>
                            <span className="neo-info-value">{order.invoice_number}</span>
                        </div>
                    )}
                    {order.invoice_date && (
                        <div className="neo-info-item">
                            <span className="neo-info-label">تاریخ فاکتور</span>
                            <span className="neo-info-value">
                                {new Date(order.invoice_date).toLocaleDateString('fa-IR')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Customer Comment Section */}
                {(order.customer_comment || isEditing) && (
                    <div className="neo-comment-section">
                        <h3 className="neo-comment-title">توضیحات مشتری</h3>
                        {!isEditing ? (
                            <div className="neo-comment-display">
                                <p className="neo-comment-text">
                                    {order.customer_comment || 'هیچ توضیحی ارائه نشده'}
                                </p>
                                {order.status === 'pending_pricing' && (
                                    <NeoBrutalistButton
                                        text="ویرایش نظر"
                                        color="blue-400"
                                        textColor="white"
                                        onClick={() => setIsEditing(true)}
                                        className="neo-edit-btn"
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="neo-edit-form">
                                <NeoBrutalistInput
                                    type="text"
                                    value={editedComment}
                                    onChange={(e) => setEditedComment(e.target.value)}
                                    placeholder="نظرات خود را وارد کنید..."
                                />
                                <div className="neo-edit-actions">
                                    <NeoBrutalistButton
                                        text="ذخیره"
                                        color="green-400"
                                        textColor="black"
                                        onClick={() => setIsEditing(false)}
                                        className="neo-edit-btn"
                                    />
                                    <NeoBrutalistButton
                                        text="لغو"
                                        color="gray-400"
                                        textColor="black"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditedComment(order.customer_comment || '');
                                        }}
                                        className="neo-edit-btn"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </NeoBrutalistCard>

            {/* Order Items */}
            <NeoBrutalistCard className="neo-items-card">
                <div className="neo-card-header">
                    <h2 className="neo-card-title">اقلام سفارش</h2>
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

            {/* Admin Reply */}
            {order.admin_comment && (
                <NeoBrutalistCard className="neo-admin-reply-card">
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">پاسخ مدیر</h2>
                    </div>
                    <div className="neo-admin-info-grid">
                        <div className="neo-info-item">
                            <span className="neo-info-label">تاریخ قیمت‌گذاری</span>
                            <span className="neo-info-value">
                                {order.pricing_date
                                    ? new Date(order.pricing_date).toLocaleDateString('fa-IR')
                                    : 'هنوز قیمت‌گذاری نشده'
                                }
                            </span>
                        </div>
                        <div className="neo-info-item">
                            <span className="neo-info-label">یادداشت‌های مدیر</span>
                            <span className="neo-info-value">{order.admin_comment}</span>
                        </div>
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Customer Approval Section */}
            {order.status === 'waiting_customer_approval' && (
                <NeoBrutalistCard className="neo-approval-section">
                    <h2 className="neo-approval-title">تأیید سفارش و صدور فاکتور</h2>
                    <p className="neo-phara-text">با تایید این سفارش، فاکتور نهایی صادر خواهد شد و قابل دانلود می‌باشد.</p>

                    <div className="neo-approval-form">
                        <div className="neo-radio-group">
                            <label className="neo-radio-label">
                                <input
                                    type="radio"
                                    name="approval"
                                    value="approve"
                                    checked={approvalDecision === 'approve'}
                                    onChange={(e) => setApprovalDecision(e.target.value)}
                                    className="neo-radio-input"
                                />
                                <span className="neo-radio-text">تایید و صدور فاکتور</span>
                            </label>
                            <label className="neo-radio-label">
                                <input
                                    type="radio"
                                    name="approval"
                                    value="reject"
                                    checked={approvalDecision === 'reject'}
                                    onChange={(e) => setApprovalDecision(e.target.value)}
                                    className="neo-radio-input"
                                />
                                <span className="neo-radio-text">رد سفارش</span>
                            </label>
                        </div>

                        {approvalDecision === 'reject' && (
                            <div className="neo-rejection-reason">
                                <NeoBrutalistInput
                                    type="text"
                                    placeholder="لطفا دلیل رد را ذکر کنید..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="neo-approval-actions">
                            <NeoBrutalistButton
                                text={
                                    generatingInvoice ? "در حال صدور فاکتور..." :
                                        submitting ? "در حال ارسال..." :
                                            "ارسال تصمیم"
                                }
                                color="yellow-400"
                                textColor="black"
                                onClick={handleApprovalSubmit}
                                disabled={submitting || generatingInvoice || !approvalDecision}
                                className="neo-submit-decision-btn"
                            />
                        </div>
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Invoice Section */}
            {order.status === 'confirmed' && order.invoice_number && (
                <NeoBrutalistCard className="neo-invoice-card">
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">فاکتور نهایی</h2>
                    </div>
                    <div className="neo-invoice-info-grid">
                        <div className="neo-info-item">
                            <span className="neo-info-label">شماره فاکتور</span>
                            <span className="neo-info-value">{order.invoice_number}</span>
                        </div>
                        <div className="neo-info-item">
                            <span className="neo-info-label">تاریخ صدور</span>
                            <span className="neo-info-value">
                                {new Date(order.invoice_date).toLocaleDateString('fa-IR')}
                            </span>
                        </div>
                        <div className="neo-info-item">
                            <span className="neo-info-label">مبلغ قابل پرداخت</span>
                            <span className="neo-info-value neo-payable-amount">
                                {formatPrice(order.quoted_total)}
                            </span>
                        </div>
                    </div>
                    <div className="neo-invoice-actions">
                        <NeoBrutalistButton
                            text="دانلود فاکتور PDF"
                            color="green-400"
                            textColor="white"
                            onClick={downloadInvoice}
                            className="neo-download-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Order Status Messages */}
            {order.status === 'confirmed' && (
                <div className="neo-status-message neo-success">
                    <span className="neo-status-icon">✅</span>
                    <span>سفارش با موفقیت تایید شد و فاکتور صادر گردید!</span>
                </div>
            )}

            {order.status === 'rejected' && order.customer_rejection_reason && (
                <NeoBrutalistCard className="neo-admin-reply-card">
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">دلیل رد</h2>
                    </div>
                    <p className="neo-comment-text">{order.customer_rejection_reason}</p>
                </NeoBrutalistCard>
            )}
        </div>
    );
};

export default OrderDetailPage;