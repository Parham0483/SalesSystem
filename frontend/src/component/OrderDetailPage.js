import React, { useState, useEffect, useRef } from 'react';
import API from './api';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import PaymentReceiptUploadModal from './PaymentReceiptUploadModal';
import '../styles/component/CustomerComponent/OrderDetail.css';

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

    // Payment upload modal state
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // NEW: Payment receipts management
    const [paymentReceipts, setPaymentReceipts] = useState([]);
    const [loadingReceipts, setLoadingReceipts] = useState(false);
    const [receiptsError, setReceiptsError] = useState('');

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

    // NEW: Fetch payment receipts when order loads
    useEffect(() => {
        if (order && (order.status === 'payment_uploaded' || order.has_payment_receipts || order.payment_receipts?.length > 0)) {
            fetchPaymentReceipts();
        }
    }, [order]);

    const fetchOrder = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await API.get(`/orders/${orderId}/`);
            setOrder(response.data);
            setEditedComment(response.data.customer_comment || '');
        } catch (err) {
            console.error('❌ Error fetching order:', err);
            setError('خطا در بارگیری جزئیات سفارش');
        } finally {
            setLoading(false);
        }
    };

    // NEW: Fetch payment receipts
    const fetchPaymentReceipts = async () => {
        setLoadingReceipts(true);
        setReceiptsError('');
        try {
            const response = await API.get(`/orders/${orderId}/payment-receipts/`);
            setPaymentReceipts(response.data.receipts || []);
        } catch (err) {
            console.error('❌ Error fetching payment receipts:', err);
            setReceiptsError('خطا در بارگیری رسیدهای پرداخت');
        } finally {
            setLoadingReceipts(false);
        }
    };

    // NEW: Delete payment receipt
    const deletePaymentReceipt = async (receiptId) => {
        if (!window.confirm('آیا از حذف این رسید اطمینان دارید؟')) {
            return;
        }

        try {
            await API.delete(`/orders/${orderId}/delete-payment-receipt/${receiptId}/`);

            // Remove from local state
            setPaymentReceipts(prev => prev.filter(receipt => receipt.id !== receiptId));

            // Refresh order data
            fetchOrder();

            alert('رسید با موفقیت حذف شد');
        } catch (err) {
            console.error('❌ Error deleting payment receipt:', err);
            alert('خطا در حذف رسید پرداخت');
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
        setError('');

        try {
            if (approvalDecision === 'approve') {
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
            console.error('❌ Error submitting approval:', err);
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
            console.error('❌ Error downloading invoice:', err);
            setError('خطا در دانلود فاکتور');
        }
    };

    // UPDATED: Payment upload success handler
    const handlePaymentUploadSuccess = (response) => {
        console.log('✅ Payment upload successful:', response);

        // Refresh order data to show updated payment status
        fetchOrder();

        // Refresh payment receipts
        fetchPaymentReceipts();

        // Close modal
        setIsPaymentModalOpen(false);

        // Clear any previous errors
        setError('');
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
            'waiting_customer_approval': 'در انتظار تأیید',
            'confirmed': 'تأیید شده و فاکتور صادر شد',
            'payment_uploaded': 'رسید پرداخت آپلود شده',
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

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

            {/* Order Information */}
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

            {/* UPDATED: Payment Receipt Upload Section */}
            {(order.status === 'confirmed' && !order.has_payment_receipts) && (
                <NeoBrutalistCard className="neo-payment-upload-card">
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">آپلود رسید پرداخت</h2>
                    </div>
                    <div className="neo-payment-upload-content">
                        <p className="neo-payment-instructions">
                            لطفاً رسید(های) پرداخت یا تصویر چک خود را آپلود کنید. می‌توانید چندین فایل انتخاب کنید.
                            پس از بررسی و تایید توسط مدیر، سفارش شما تکمیل خواهد شد.
                        </p>

                        <div className="neo-upload-button-container">
                            <NeoBrutalistButton
                                text="📄 آپلود رسیدهای پرداخت"
                                color="yellow-400"
                                textColor="black"
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="neo-upload-receipt-btn"
                            />
                        </div>
                    </div>
                </NeoBrutalistCard>
            )}

            {/* UPDATED: Payment Receipts Status - Multiple Receipts Support */}
            {(order.has_payment_receipts || paymentReceipts.length > 0) && (
                <NeoBrutalistCard className="neo-payment-status-card">
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">
                            رسیدهای پرداخت ({paymentReceipts.length})
                        </h2>
                        {loadingReceipts && <span>🔄 در حال بارگیری...</span>}
                    </div>

                    {receiptsError && (
                        <div className="neo-error-message">
                            <span>⚠️ {receiptsError}</span>
                        </div>
                    )}

                    <div className="neo-payment-receipts-content">
                        {/* Allow adding more receipts if still in confirmed status */}
                        {order.status === 'confirmed' && (
                            <div className="neo-add-more-receipts">
                                <NeoBrutalistButton
                                    text="➕ افزودن رسید جدید"
                                    color="blue-400"
                                    textColor="white"
                                    onClick={() => setIsPaymentModalOpen(true)}
                                    className="neo-add-receipt-btn"
                                />
                            </div>
                        )}

                        {/* Display all payment receipts */}
                        <div className="neo-receipts-grid">
                            {paymentReceipts.map((receipt, index) => (
                                <div key={receipt.id} className="neo-receipt-item" data-file-type={receipt.file_type}>
                                    <div className="neo-receipt-header">
                                        <h4>رسید {index + 1}</h4>
                                        <div className="neo-receipt-meta">
                                            <span className="neo-receipt-type">
                                                {receipt.file_type === 'pdf' ? '📄 PDF' : '🖼️ تصویر'}
                                            </span>
                                            <span className="neo-receipt-size">
                                                {formatFileSize(receipt.file_size)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="neo-receipt-info">
                                        <div className="neo-receipt-details">
                                            <div className="neo-info-item">
                                                <span className="neo-info-label">نام فایل:</span>
                                                <span className="neo-info-value">{receipt.file_name}</span>
                                            </div>
                                            <div className="neo-info-item">
                                                <span className="neo-info-label">تاریخ آپلود:</span>
                                                <span className="neo-info-value">
                                                    {new Date(receipt.uploaded_at).toLocaleDateString('fa-IR')}
                                                </span>
                                            </div>
                                            <div className="neo-info-item">
                                                <span className="neo-info-label">وضعیت:</span>
                                                <span className={`neo-info-value ${
                                                    receipt.is_verified ? 'neo-receipt-verified' : 'neo-receipt-pending'
                                                }`}>
                                                    {receipt.is_verified ? '✅ تایید شده' : ' در انتظار بررسی'}
                                                </span>
                                            </div>
                                            <div className="neo-info-item">
                                                <span className="neo-info-label">آپلود شده توسط:</span>
                                                <span className="neo-info-value">{receipt.uploaded_by}</span>
                                            </div>
                                            {receipt.admin_notes && (
                                                <div className="neo-info-item">
                                                    <span className="neo-info-label">توضیحات مدیر:</span>
                                                    <span className="neo-info-value">{receipt.admin_notes}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Receipt preview */}
                                        <div className="neo-receipt-preview">
                                            {receipt.file_type === 'image' ? (
                                                <img
                                                    src={receipt.file_url}
                                                    alt={`رسید پرداخت ${index + 1}`}
                                                    className="neo-receipt-image"
                                                    onClick={() => window.open(receipt.file_url, '_blank')}
                                                />
                                            ) : (
                                                <div className="neo-pdf-preview">
                                                    <div className="neo-pdf-icon">📄</div>
                                                    <p className="neo-pdf-name">{receipt.file_name}</p>
                                                    <NeoBrutalistButton
                                                        text="🔍 مشاهده PDF"
                                                        color="blue-400"
                                                        textColor="white"
                                                        onClick={() => window.open(receipt.file_url, '_blank')}
                                                        className="neo-pdf-view-btn"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Receipt actions */}
                                    <div className="neo-receipt-actions">
                                        <NeoBrutalistButton
                                            text="📥 دانلود"
                                            color="green-400"
                                            textColor="black"
                                            onClick={() => {
                                                const link = document.createElement('a');
                                                link.href = receipt.file_url;
                                                link.download = receipt.file_name;
                                                link.click();
                                            }}
                                            className="neo-download-receipt-btn"
                                        />

                                        {/* Allow deletion only if order is still in confirmed status */}
                                        {order.status === 'confirmed' && (
                                            <NeoBrutalistButton
                                                text="🗑️ حذف"
                                                color="red-400"
                                                textColor="white"
                                                onClick={() => deletePaymentReceipt(receipt.id)}
                                                className="neo-delete-receipt-btn"
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Overall payment status */}
                        <div className="neo-payment-summary">
                            <div className="neo-summary-stats">
                                <div className="neo-stat-item">
                                    <span className="neo-stat-label">کل رسیدها:</span>
                                    <span className="neo-stat-value">{paymentReceipts.length}</span>
                                </div>
                                <div className="neo-stat-item">
                                    <span className="neo-stat-label">تایید شده:</span>
                                    <span className="neo-stat-value">
                                        {paymentReceipts.filter(r => r.is_verified).length}
                                    </span>
                                </div>
                                <div className="neo-stat-item">
                                    <span className="neo-stat-label">در انتظار:</span>
                                    <span className="neo-stat-value">
                                        {paymentReceipts.filter(r => !r.is_verified).length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Legacy single payment receipt support (for backward compatibility) */}
            {order.payment_receipt && !order.has_payment_receipts && (
                <NeoBrutalistCard className="neo-payment-status-card">
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">وضعیت رسید پرداخت (قدیمی)</h2>
                    </div>
                    <div className="neo-payment-status-content">
                        <div className="neo-payment-info-grid">
                            <div className="neo-info-item">
                                <span className="neo-info-label">تاریخ آپلود:</span>
                                <span className="neo-info-value">
                                    {new Date(order.payment_receipt_uploaded_at).toLocaleDateString('fa-IR')}
                                </span>
                            </div>
                            <div className="neo-info-item">
                                <span className="neo-info-label">وضعیت:</span>
                                <span className={`neo-info-value ${
                                    order.payment_verified ? 'neo-payment-verified' : 'neo-payment-pending'
                                }`}>
                                    {order.payment_verified ? '✅ تایید شده' : ' در انتظار بررسی'}
                                </span>
                            </div>
                            {order.payment_notes && (
                                <div className="neo-info-item">
                                    <span className="neo-info-label">توضیحات مدیر:</span>
                                    <span className="neo-info-value">{order.payment_notes}</span>
                                </div>
                            )}
                        </div>

                        <div className="neo-payment-receipt-preview">
                            <img
                                src={order.payment_receipt}
                                alt="رسید پرداخت"
                                className="neo-receipt-image"
                                onClick={() => window.open(order.payment_receipt, '_blank')}
                            />
                            <p className="neo-receipt-hint">برای مشاهده در اندازه کامل کلیک کنید</p>
                        </div>
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

            {order.status === 'payment_uploaded' && (
                <div className="neo-status-message neo-info">
                    <span className="neo-status-icon">📄</span>
                    <span>رسیدهای پرداخت شما آپلود شد و در انتظار بررسی توسط مدیر می‌باشد.</span>
                </div>
            )}

            {order.status === 'completed' && (
                <div className="neo-status-message neo-success">
                    <span className="neo-status-icon">🎉</span>
                    <span>سفارش شما با موفقیت تکمیل شد! از خرید شما متشکریم.</span>
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

            {/* Payment Upload Modal */}
            {isPaymentModalOpen && (
                <PaymentReceiptUploadModal
                    orderId={order.id}
                    onUploadSuccess={handlePaymentUploadSuccess}
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                />
            )}
        </div>
    );
};

export default OrderDetailPage;