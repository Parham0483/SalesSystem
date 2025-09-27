import React, { useState, useEffect, useRef } from 'react';
import API from './api';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import PaymentReceiptUploadModal from './PaymentReceiptUploadModal';
import CustomerInfoManagement from './CustomerInfoManagement';
import '../styles/component/CustomerComponent/OrderDetail.css';

// Enhanced InvoiceManager Component
const InvoiceManager = ({ order, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [invoiceStatus, setInvoiceStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(false);

    useEffect(() => {
        if (order?.id) {
            fetchInvoiceStatus();
        }
    }, [order?.id]);

    const fetchInvoiceStatus = async () => {
        if (!order?.id) return;

        setLoadingStatus(true);
        try {
            const response = await API.get(`/orders/${order.id}/invoice-status/`);
            setInvoiceStatus(response.data);
        } catch (error) {
            console.error('Error fetching invoice status:', error);
            // Create fallback status from order data
            setInvoiceStatus({
                business_invoice_type_display: order.business_invoice_type === 'official' ? 'فاکتور رسمی' : 'فاکتور غیررسمی',
                quoted_total: order.quoted_total || 0,
                can_download_final_invoice: order.status === 'completed',
                final_invoice_available: order.status === 'completed',
                can_download_pre_invoice: order.status === 'waiting_customer_approval',
                pre_invoice_available: order.status === 'waiting_customer_approval',
                order_status: order.status
            });
        } finally {
            setLoadingStatus(false);
        }
    };

    const formatPrice = (price) => {
        if (price === null || price === undefined || isNaN(price)) {
            return 'در انتظار';
        }
        const numericPrice = parseFloat(price);
        if (numericPrice === 0) {
            return 'در انتظار';
        }
        try {
            return `${new Intl.NumberFormat('fa-IR').format(numericPrice)} ریال`;
        } catch (error) {
            console.error('Price formatting error:', error, 'for price:', price);
            return `${numericPrice} ریال`;
        }
    };

    const downloadPreInvoice = async () => {
        if (!order?.id) return;

        setLoading(true);
        try {
            const response = await API.get(`/orders/${order.id}/download-pre-invoice/`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `pre_invoice_${order.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading pre-invoice:', err);
            if (err.response?.data?.error) {
                alert(`خطا: ${err.response.data.error}`);
            } else {
                alert('خطا در دانلود پیش‌فاکتور');
            }
        } finally {
            setLoading(false);
        }
    };

    const downloadFinalInvoice = async () => {
        if (!order?.id) return;

        setLoading(true);
        try {
            const response = await API.get(`/orders/${order.id}/download-final-invoice/`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `final_invoice_${order.id}_${order.business_invoice_type}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading final invoice:', err);
            if (err.response?.data?.error) {
                alert(`خطا: ${err.response.data.error}`);
            } else {
                alert('خطا در دانلود فاکتور نهایی');
            }
        } finally {
            setLoading(false);
        }
    };

    if (loadingStatus) {
        return (
            <div className="neo-invoice-card">
                <div className="neo-loading-content">
                    <span>📄 در حال بارگیری وضعیت فاکتور...</span>
                </div>
            </div>
        );
    }

    if (!invoiceStatus) {
        return (
            <div className="neo-invoice-card">
                <div className="neo-error-content">
                    <span>⚠ خطا در بارگیری وضعیت فاکتور</span>
                </div>
            </div>
        );
    }

    return (
        <div className="neo-invoice-card">
            <div className="neo-card-header">
                <h3 className="neo-card-title">مدیریت فاکتور</h3>
                <div className="neo-invoice-status-badges">
                    {invoiceStatus.pre_invoice_available && (
                        <span className="neo-badge neo-badge-info">پیش‌فاکتور موجود</span>
                    )}
                    {invoiceStatus.final_invoice_available && (
                        <span className="neo-badge neo-badge-success">فاکتور نهایی موجود</span>
                    )}
                    {invoiceStatus.payment_verified && (
                        <span className="neo-badge neo-badge-verified">پرداخت تأیید شده</span>
                    )}
                </div>
            </div>

            <div className="neo-invoice-info-grid">
                <div className="neo-info-item">
                    <span className="neo-info-label">نوع فاکتور فعلی</span>
                    <span className={`neo-info-value ${order?.business_invoice_type === 'official' ? 'neo-official-invoice' : 'neo-unofficial-invoice'}`}>
                        {invoiceStatus.business_invoice_type_display}
                    </span>
                </div>

                <div className="neo-info-item">
                    <span className="neo-info-label">مبلغ کل</span>
                    <span className="neo-info-value">
                        {formatPrice(invoiceStatus.quoted_total)}
                    </span>
                </div>

                {order?.business_invoice_type === 'official' && invoiceStatus.total_with_tax && (
                    <div className="neo-info-item">
                        <span className="neo-info-label">مبلغ نهایی (با مالیات)</span>
                        <span className="neo-info-value neo-total-with-tax">
                            {formatPrice(invoiceStatus.total_with_tax)}
                        </span>
                    </div>
                )}
            </div>

            <div className="neo-invoice-actions">
                {invoiceStatus.can_download_pre_invoice && (
                    <div className="neo-action-group">
                        <h4 className="neo-action-group-title">پیش‌فاکتور (معتبر تا انتها روز کاری)</h4>
                        <div className="neo-action-buttons">
                            <button
                                className="neo-btn neo-btn-secondary"
                                onClick={downloadPreInvoice}
                                disabled={loading}
                            >
                                {loading ? 'در حال دانلود...' : 'دانلود پیش‌فاکتور'}
                            </button>
                        </div>
                    </div>
                )}

                {invoiceStatus.can_download_final_invoice && (
                    <div className="neo-action-group">
                        <h4 className="neo-action-group-title">فاکتور نهایی</h4>
                        <div className="neo-action-buttons">
                            <button
                                className="neo-btn neo-btn-primary"
                                onClick={downloadFinalInvoice}
                                disabled={loading}
                            >
                                {loading ? 'در حال دانلود...' : 'دانلود فاکتور نهایی'}
                            </button>
                        </div>
                    </div>
                )}

                {!invoiceStatus.can_download_pre_invoice && !invoiceStatus.can_download_final_invoice && (
                    <div className="neo-no-invoices-message">
                        <div className="neo-message-icon">📄</div>
                        <div className="neo-message-content">
                            <span className="neo-message-title">فاکتور برای دانلود در دسترس نیست</span>
                            <div className="neo-status-explanation">
                                {invoiceStatus.order_status === 'pending_pricing' && 'منتظر قیمت‌گذاری توسط مدیر'}
                                {invoiceStatus.order_status === 'waiting_customer_approval' && 'منتظر تأیید شما برای صدور پیش‌فاکتور'}
                                {invoiceStatus.order_status === 'confirmed' && !invoiceStatus.pre_invoice_available && 'پیش‌فاکتور در حال تولید...'}
                                {invoiceStatus.order_status === 'payment_uploaded' && 'منتظر تأیید پرداخت برای صدور فاکتور نهایی'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// Enhanced AuthenticatedImage Component
const AuthenticatedImage = ({ receipt, onError }) => {
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (receipt?.file_type === 'image') {
            loadImage();
        }
    }, [receipt?.id]);

    const loadImage = async () => {
        if (!receipt) return;

        try {
            setLoading(true);
            setError(null);

            const imageUrl = receipt.file_url || receipt.download_url;

            if (!imageUrl) {
                throw new Error('Image URL not available');
            }

            setImageData(imageUrl);
            setLoading(false);

        } catch (err) {
            console.error('Error loading image:', err);
            setError(err.message);
            setLoading(false);
            if (onError) {
                onError(err);
            }
        }
    };

    if (loading) {
        return (
            <div className="neo-image-loading" style={{
                textAlign: 'center',
                padding: '20px',
                border: '2px dashed #ccc',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
            }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
                <span>در حال بارگیری تصویر...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="neo-image-error" style={{
                textAlign: 'center',
                padding: '20px',
                color: '#ef4444',
                border: '2px solid #ef4444',
                borderRadius: '8px',
                backgroundColor: '#fef2f2'
            }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
                <div style={{ marginBottom: '10px' }}>خطا در بارگیری تصویر</div>
                <button
                    onClick={loadImage}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}
                >
                    تلاش مجدد
                </button>
            </div>
        );
    }

    if (!imageData) {
        return (
            <div className="neo-image-placeholder" style={{
                textAlign: 'center',
                padding: '20px',
                color: '#6b7280',
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#f9fafb'
            }}>
                <span>تصویر در دسترس نیست</span>
            </div>
        );
    }

    return (
        <div className="neo-image-container">
            <img
                src={imageData}
                alt={`رسید پرداخت ${receipt?.file_name || 'unknown'}`}
                className="neo-receipt-image"
                onClick={() => window.open(imageData, '_blank')}
                style={{
                    width: '100%',
                    maxWidth: '100%',
                    maxHeight: '400px',
                    objectFit: 'contain',
                    cursor: 'pointer',
                    border: '2px solid #000',
                    borderRadius: '8px',
                    backgroundColor: '#fff'
                }}
                onError={(e) => {
                    console.error('Image render error:', e);
                    setError('خطا در نمایش تصویر');
                }}
            />
        </div>
    );
};

const OrderDetailPage = ({ orderId, onOrderUpdated }) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [approvalDecision, setApprovalDecision] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [generatingInvoice, setGeneratingInvoice] = useState(false);

    // Payment upload modal state
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    // Customer info management
    const [isCustomerInfoModalOpen, setIsCustomerInfoModalOpen] = useState(false);
    const [customerInfo, setCustomerInfo] = useState(null);
    const [loadingCustomerInfo, setLoadingCustomerInfo] = useState(false);

    // Payment receipts management
    const [paymentReceipts, setPaymentReceipts] = useState([]);
    const [loadingReceipts, setLoadingReceipts] = useState(false);
    const [receiptsError, setReceiptsError] = useState('');

    const tableRef = useRef(null);

    useEffect(() => {
        if (orderId) {
            fetchOrder();
            fetchCustomerInfo();
        }
    }, [orderId]);

    useEffect(() => {
        if (order?.items && tableRef.current) {
            applySmartTextSizing();
        }
    }, [order?.items]);

    useEffect(() => {
        if (order && (order.status === 'payment_uploaded' || order.has_payment_receipts || order.payment_receipts?.length > 0)) {
            fetchPaymentReceipts();
        }
    }, [order?.id, order?.status, order?.has_payment_receipts]);

    const fetchOrder = async () => {
        if (!orderId) return;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        setLoading(true);
        setError('');

        try {
            console.log('Fetching order:', orderId);

            const response = await API.get(`/orders/${orderId}/`, {
                signal: controller.signal,
                timeout: 15000
            });

            clearTimeout(timeoutId);
            console.log('Order response:', response.data);

            if (response.data) {
                setOrder(response.data);
            } else {
                throw new Error('No order data received');
            }

        } catch (err) {
            clearTimeout(timeoutId);
            console.error('Error fetching order:', err);

            if (err.name === 'AbortError') {
                setError('درخواست منقضی شد. لطفا دوباره تلاش کنید');
            } else if (err.response?.status === 404) {
                setError('سفارش پیدا نشد');
            } else if (err.response?.status === 403) {
                setError('شما اجازه دسترسی به این سفارش را ندارید');
            } else if (err.response?.status === 401) {
                setError('لطفا دوباره وارد شوید');
            } else if (err.code === 'NETWORK_ERROR' || err.message.includes('Network Error')) {
                setError('خطا در اتصال به شبکه. لطفا اتصال اینترنت خود را بررسی کنید');
            } else {
                setError(`خطا در بارگیری جزئیات سفارش: ${err.message || 'خطایی نامشخص'}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomerInfo = async () => {
        setLoadingCustomerInfo(true);
        try {
            const response = await API.get('/customers/invoice-info/');
            if (response.status === 200) {
                setCustomerInfo(response.data.customer_info);
            }
        } catch (err) {
            console.error('Error fetching customer info:', err);
        } finally {
            setLoadingCustomerInfo(false);
        }
    };

    const fetchPaymentReceipts = async () => {
        if (!orderId) return;

        setLoadingReceipts(true);
        setReceiptsError('');
        try {
            const response = await API.get(`/orders/${orderId}/payment-receipts/`);
            setPaymentReceipts(response.data.receipts || []);
        } catch (err) {
            console.error('Error fetching payment receipts:', err);
            setReceiptsError('خطا در بارگیری رسیدهای پرداخت');
        } finally {
            setLoadingReceipts(false);
        }
    };

    // Helper functions
    const deletePaymentReceipt = async (receiptId) => {
        if (!orderId || !receiptId) return;

        if (!window.confirm('آیا از حذف این رسید اطمینان دارید؟')) {
            return;
        }

        try {
            await API.delete(`/orders/${orderId}/delete-payment-receipt/${receiptId}/`);
            setPaymentReceipts(prev => prev.filter(receipt => receipt.id !== receiptId));
            fetchOrder();
            alert('رسید با موفقیت حذف شد');
        } catch (err) {
            console.error('Error deleting payment receipt:', err);
            alert('خطا در حذف رسید پرداخت');
        }
    };

    const handleDownloadReceipt = async (receipt) => {
        if (!receipt) return;

        try {
            const downloadUrl = receipt.file_url || receipt.download_url;

            if (!downloadUrl) {
                alert('لینک دانلود در دسترس نیست');
                return;
            }

            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = receipt.file_name;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('Error downloading file:', error);
            alert('خطا در دانلود فایل');
        }
    };

    const handleViewPDF = async (receipt) => {
        if (!receipt) return;

        try {
            const viewUrl = receipt.file_url || receipt.download_url;

            if (!viewUrl) {
                alert('فایل PDF در دسترس نیست');
                return;
            }

            const newWindow = window.open(viewUrl, '_blank');

            if (!newWindow) {
                const link = document.createElement('a');
                link.href = viewUrl;
                link.download = receipt.file_name;
                link.click();
            }

        } catch (error) {
            console.error('Error viewing PDF:', error);
            alert('خطا در مشاهده فایل PDF');
        }
    };

    const renderReceiptPreview = (receipt, index) => {
        if (!receipt) return null;

        if (receipt.file_type === 'image') {
            return (
                <div className="neo-receipt-preview" key={`image-${receipt.id}`}>
                    <AuthenticatedImage
                        receipt={receipt}
                        onError={(err) => {
                            console.error(`Receipt ${receipt.id} image load error:`, err);
                        }}
                    />
                </div>
            );
        } else {
            return (
                <div className="neo-receipt-preview" key={`pdf-${receipt.id}`}>
                    <div className="neo-pdf-preview">
                        <p className="neo-pdf-name">{receipt.file_name}</p>
                        <NeoBrutalistButton
                            text="📄 مشاهده PDF"
                            color="blue-400"
                            textColor="white"
                            onClick={() => handleViewPDF(receipt)}
                            className="neo-pdf-view-btn"
                        />
                    </div>
                </div>
            );
        }
    };

    const applySmartTextSizing = () => {
        if (!tableRef.current) return;

        const productCells = tableRef.current.querySelectorAll('.neo-table-cell:nth-child(1)');
        const notesCells = tableRef.current.querySelectorAll('.neo-table-cell:nth-child(3)');

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

        if (!orderId) {
            setError('شناسه سفارش موجود نیست');
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
            console.error('⚠ Error submitting approval:', err);
            setError(err.response?.data?.error || 'خطا در ارسال تصمیم');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePaymentUploadSuccess = (response) => {
        fetchOrder();
        fetchPaymentReceipts();
        setIsPaymentModalOpen(false);
        setError('');
    };

    const handleCustomerInfoUpdate = (updatedInfo) => {
        setCustomerInfo(updatedInfo);
        fetchOrder();
    };

    // Status and formatting functions
    const getStatusColor = (status) => {
        if (!status) return 'gray-400';

        switch (status) {
            case 'pending_pricing': return 'yellow-400';
            case 'waiting_customer_approval': return 'blue-400';
            case 'confirmed': return 'green-400';
            case 'payment_uploaded': return 'purple-400';
            case 'completed': return 'green-600';
            case 'rejected': return 'red-400';
            case 'cancelled': return 'gray-400';
            default: return 'gray-400';
        }
    };

    const formatStatus = (status) => {
        if (!status) return 'نامشخص';

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
        if (price === null || price === undefined || isNaN(price)) {
            return 'در انتظار';
        }
        const numericPrice = parseFloat(price);
        if (numericPrice === 0) {
            return 'در انتظار';
        }
        try {
            return `${new Intl.NumberFormat('fa-IR').format(numericPrice)} ریال`;
        } catch (error) {
            console.error('Price formatting error:', error, 'for price:', price);
            return `${numericPrice} ریال`;
        }
    };

    const formatQuantity = (quantity) => {
        if (quantity === null || quantity === undefined || isNaN(quantity)) {
            return 'در انتظار';
        }
        const numericQuantity = parseInt(quantity);
        if (numericQuantity === 0) {
            return 'در انتظار';
        }
        try {
            return new Intl.NumberFormat('fa-IR').format(numericQuantity);
        } catch (error) {
            console.error('Quantity formatting error:', error, 'for quantity:', quantity);
            return numericQuantity.toString();
        }
    };

    const calculateTotal = (unitPrice, quantity) => {
        if (!unitPrice || !quantity || isNaN(unitPrice) || isNaN(quantity)) {
            return 'در انتظار';
        }
        const numericPrice = parseFloat(unitPrice);
        const numericQuantity = parseInt(quantity);
        if (numericPrice === 0 || numericQuantity === 0) {
            return 'در انتظار';
        }
        try {
            const total = numericPrice * numericQuantity;
            return `${new Intl.NumberFormat('fa-IR').format(total)} ریال`;
        } catch (error) {
            console.error('Total calculation error:', error, 'for price:', unitPrice, 'quantity:', quantity);
            return 'خطا در محاسبه';
        }
    };

    const truncateText = (text, maxLength = 30) => {
        if (!text) return '-';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const isOfficialInvoice = () => {
        return order?.business_invoice_type === 'official';
    };

    const isCustomerInfoComplete = () => {
        if (!customerInfo || !isOfficialInvoice()) return true;

        const required = ['national_id', 'complete_address', 'postal_code'];
        return required.every(field => customerInfo[field] && customerInfo[field].trim() !== '');
    };

    const calculateItemTax = (unitPrice, quantity, taxRate) => {
        if (!unitPrice || !quantity || !taxRate) return 0;
        const subtotal = unitPrice * quantity;
        return subtotal * (taxRate / 100);
    };

    const calculateItemTotal = (unitPrice, quantity, taxRate) => {
        if (!unitPrice || !quantity) return 0;
        const subtotal = unitPrice * quantity;
        const tax = taxRate ? subtotal * (taxRate / 100) : 0;
        return subtotal + tax;
    };

    // Loading and error states
    if (loading) {
        return (
            <div className="neo-order-detail">
                <NeoBrutalistCard className="neo-loading-card">
                    <div className="neo-loading-content">
                        <span>📄</span>
                        <span className="neo-loading-text">در حال بارگذاری جزئیات سفارش...</span>

                        <div style={{
                            width: '200px',
                            height: '4px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '2px',
                            margin: '1rem auto',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: '#3b82f6',
                                animation: 'loading-progress 2s infinite',
                                transformOrigin: 'left'
                            }} />
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'center',
                            marginTop: '1rem'
                        }}>
                            <button
                                onClick={() => {
                                    setLoading(false);
                                    setError('بارگیری لغو شد');
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                لغو
                            </button>
                            <button
                                onClick={fetchOrder}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                تلاش مجدد
                            </button>
                        </div>
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

                        <button
                            onClick={() => {
                                setError('');
                                fetchOrder();
                            }}
                            style={{
                                marginTop: '1rem',
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold'
                            }}
                        >
                            تلاش مجدد
                        </button>
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
                        <span className="neo-error-icon">⚠</span>
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
                        <span className="neo-info-value">{order.customer_name || 'نامشخص'}</span>
                    </div>
                    <div className="neo-info-item">
                        <span className="neo-info-label">شماره تماس</span>
                        <span className="neo-info-value">{order.customer_phone || 'ثبت نشده'}</span>
                    </div>
                    <div className="neo-info-item">
                        <span className="neo-info-label">تاریخ ایجاد</span>
                        <span className="neo-info-value">
                            {order.created_at ? new Date(order.created_at).toLocaleDateString('fa-IR') : 'نامشخص'}
                        </span>
                    </div>
                    <div className="neo-info-item">
                        <span className="neo-info-label">وضعیت</span>
                        <span className="neo-info-value">{formatStatus(order.status)}</span>
                    </div>

                    <div className="neo-info-item">
                        <span className="neo-info-label">نوع فاکتور</span>
                        <span className={`neo-info-value ${isOfficialInvoice() ? 'neo-official-invoice' : 'neo-unofficial-invoice'}`}>
                            {order.business_invoice_type_display || (isOfficialInvoice() ? 'فاکتور رسمی' : 'فاکتور شخصی')}
                            {isOfficialInvoice() && (
                                <span className="neo-tax-badge">دارای مالیات</span>
                            )}
                        </span>
                    </div>

                    {order.quoted_total > 0 && (
                        <div className="neo-info-item">
                            <span className="neo-info-label">مبلغ کل</span>
                            <span className="neo-info-value neo-payable-amount">
                                {formatPrice(order.quoted_total)}
                            </span>
                        </div>
                    )}

                    {/* Show pricing information if available */}
                    {order.pricing_date && (
                        <div className="neo-info-item">
                            <span className="neo-info-label">تاریخ قیمت‌گذاری</span>
                            <span className="neo-info-value">
                                {new Date(order.pricing_date).toLocaleDateString('fa-IR')}
                            </span>
                        </div>
                    )}

                    {order.priced_by_name && (
                        <div className="neo-info-item">
                            <span className="neo-info-label">قیمت‌گذاری شده توسط</span>
                            <span className="neo-info-value">{order.priced_by_name}</span>
                        </div>
                    )}

                    {/* Show dealer information if assigned */}
                    {order.assigned_dealer_name && (
                        <div className="neo-info-item">
                            <span className="neo-info-label">نماینده فروش</span>
                            <span className="neo-info-value">{order.assigned_dealer_name}</span>
                        </div>
                    )}

                    {/* Customer comment */}
                    {order.customer_comment && (
                        <div className="neo-info-item full-width">
                            <span className="neo-info-label">توضیحات شما</span>
                            <span className="neo-info-value">{order.customer_comment}</span>
                        </div>
                    )}
                </div>
            </NeoBrutalistCard>

            {/* Admin Comment Section - Enhanced */}
            {order.admin_comment && order.admin_comment.trim() && (
                <NeoBrutalistCard className="neo-admin-reply-card" style={{ borderLeft: '6px solid #10b981' }}>
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">پاسخ و توضیحات مدیر</h2>
                        <span className="neo-admin-badge">پیام از مدیریت</span>
                    </div>
                    <div className="neo-comment-section">
                        <div className="neo-comment-display" style={{
                            backgroundColor: '#f0f9ff',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '2px solid #0ea5e9',
                            fontFamily: 'IRANSans, Tahoma, Arial, sans-serif'
                        }}>
                            <div className="neo-comment-icon" style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '0.5rem',
                                color: '#0369a1',
                                fontWeight: 'bold'
                            }}>
                                <span style={{ marginLeft: '0.5rem' }}>💬</span>
                                <span>پیام از مدیریت:</span>
                            </div>
                            <p className="neo-comment-text" style={{
                                margin: 0,
                                lineHeight: '1.6',
                                color: '#1e40af',
                                fontSize: '1rem'
                            }}>{order.admin_comment}</p>
                        </div>
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Invoice Manager Component */}
            {(order.status === 'waiting_customer_approval' || order.status === 'confirmed' || order.status === 'payment_uploaded' || order.status === 'completed' || (typeof window !== 'undefined' && window.userRole === 'admin')) && (
                <InvoiceManager order={order} onUpdate={fetchOrder} />
            )}

            {/* Customer Invoice Information (for official invoices) */}
            {isOfficialInvoice() && (
                <NeoBrutalistCard className="neo-customer-invoice-info-card">
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">اطلاعات فاکتور رسمی</h2>
                        <NeoBrutalistButton
                            text="ویرایش اطلاعات"
                            color="blue-400"
                            textColor="white"
                            onClick={() => setIsCustomerInfoModalOpen(true)}
                            className="edit-customer-info-btn"
                        />
                    </div>
                    <div className="neo-customer-invoice-info">
                        {loadingCustomerInfo ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <span>📄 در حال بارگیری اطلاعات...</span>
                            </div>
                        ) : (
                            <>
                                <div className="neo-info-grid">
                                    <div className="neo-info-item">
                                        <span className="neo-info-label">نام کامل:</span>
                                        <span className="neo-info-value">{customerInfo?.name || 'ثبت نشده'}</span>
                                    </div>
                                    <div className="neo-info-item">
                                        <span className="neo-info-label">شماره تماس:</span>
                                        <span className="neo-info-value">{customerInfo?.phone || 'ثبت نشده'}</span>
                                    </div>
                                    <div className="neo-info-item">
                                        <span className="neo-info-label">شناسه ملی:</span>
                                        <span className="neo-info-value">{customerInfo?.national_id || 'ثبت نشده'}</span>
                                    </div>
                                    <div className="neo-info-item">
                                        <span className="neo-info-label">شناسه اقتصادی:</span>
                                        <span className="neo-info-value">{customerInfo?.economic_id || 'ثبت نشده'}</span>
                                    </div>
                                    <div className="neo-info-item">
                                        <span className="neo-info-label">کد پستی:</span>
                                        <span className="neo-info-value">{customerInfo?.postal_code || 'ثبت نشده'}</span>
                                    </div>
                                    <div className="neo-info-item">
                                        <span className="neo-info-label">نام شرکت:</span>
                                        <span className="neo-info-value">{customerInfo?.company_name || 'شخصی'}</span>
                                    </div>
                                    <div className="neo-info-item">
                                        <span className="neo-info-label">استان:</span>
                                        <span className="neo-info-value">{customerInfo?.province || 'ثبت نشده'}</span>
                                    </div>
                                    <div className="neo-info-item">
                                        <span className="neo-info-label">شهر:</span>
                                        <span className="neo-info-value">{customerInfo?.city || 'ثبت نشده'}</span>
                                    </div>
                                    <div className="neo-info-item full-width">
                                        <span className="neo-info-label">آدرس کامل:</span>
                                        <span className="neo-info-value">{customerInfo?.complete_address || 'ثبت نشده'}</span>
                                    </div>
                                </div>

                                <div className="invoice-readiness" style={{ marginTop: '1rem' }}>
                                    {isCustomerInfoComplete() ? (
                                        <div className="readiness-indicator ready" style={{
                                            color: '#059669',
                                            backgroundColor: '#d1fae5',
                                            padding: '0.75rem',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            border: '2px solid #059669'
                                        }}>
                                            <span>✅ اطلاعات فاکتور رسمی کامل است</span>
                                        </div>
                                    ) : (
                                        <div className="readiness-indicator incomplete" style={{
                                            color: '#d97706',
                                            backgroundColor: '#fef3c7',
                                            padding: '0.75rem',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            border: '2px solid #f59e0b'
                                        }}>
                                            <span>⚠️</span>
                                            <span>برخی اطلاعات فاکتور رسمی ناقص است</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Payment receipts section */}
            {(order.has_payment_receipts || paymentReceipts.length > 0) && (
                <NeoBrutalistCard className="neo-payment-status-card">
                    <div className="neo-card-header">
                        <h2 className="neo-card-title">
                            رسیدهای پرداخت ({paymentReceipts.length})
                        </h2>
                        {loadingReceipts && <span>📄 در حال بارگیری...</span>}
                    </div>

                    {receiptsError && (
                        <div className="neo-error-message">
                            <span>⚠️ {receiptsError}</span>
                        </div>
                    )}

                    <div className="neo-payment-receipts-content">
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
                                                    {receipt.is_verified ? '✅ تایید شده' : '⏳ در انتظار بررسی'}
                                                </span>
                                            </div>
                                        </div>

                                        {renderReceiptPreview(receipt, index)}
                                    </div>

                                    <div className="neo-receipt-actions">
                                        <NeoBrutalistButton
                                            text="📥 دانلود"
                                            color="green-400"
                                            textColor="black"
                                            onClick={() => handleDownloadReceipt(receipt)}
                                            className="neo-download-receipt-btn"
                                        />

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

            {/* Order Items Table - Enhanced */}
            <NeoBrutalistCard className="neo-items-card">
                <div className="neo-card-header">
                    <h2 className="neo-card-title">اقلام سفارش</h2>
                    <div className="neo-items-summary">
                        <span>تعداد کل: {order.items?.length || 0} قلم</span>
                    </div>
                </div>
                <div className="neo-items-table-container">
                    <table
                        className="neo-items-table"
                        ref={tableRef}
                        data-invoice-type={order.business_invoice_type || 'unofficial'}
                    >
                        <thead>
                        <tr>
                            <th>نام محصول</th>
                            <th>تعداد درخواستی</th>
                            <th>یادداشت شما</th>
                            <th>قیمت واحد</th>
                            <th>تعداد نهایی</th>
                            {order.business_invoice_type === 'official' && (
                                <>
                                    <th>نرخ مالیات</th>
                                    <th>مبلغ مالیات</th>
                                </>
                            )}
                            <th>مبلغ کل</th>
                            <th>یادداشت مدیر</th>
                        </tr>
                        </thead>
                        <tbody>
                        {order.items?.map((item, index) => (
                            <tr key={index}>
                                <td title={item.product_name} data-pending={!item.product_name}>
                                    <div className="product-info">
                                        <div className="product-name">{item.product_name || 'نامشخص'}</div>
                                        {item.product_code && (
                                            <div className="product-code" style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                                کد: {item.product_code}
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td>{formatQuantity(item.requested_quantity)}</td>
                                <td title={item.customer_notes} data-pending={!item.customer_notes}>
                                    {truncateText(item.customer_notes) || '-'}
                                </td>
                                <td data-pending={!item.quoted_unit_price}>
                                    {formatPrice(item.quoted_unit_price)}
                                </td>
                                <td data-pending={!item.final_quantity}>
                                    {formatQuantity(item.final_quantity)}
                                </td>

                                {order.business_invoice_type === 'official' && (
                                    <>
                                        <td>
                                            {item.product_tax_rate ? `${parseFloat(item.product_tax_rate).toFixed(1)}%` : '0%'}
                                        </td>
                                        <td>
                                            {item.quoted_unit_price && item.final_quantity && item.product_tax_rate ?
                                                formatPrice(calculateItemTax(item.quoted_unit_price, item.final_quantity, item.product_tax_rate)) :
                                                'در انتظار'
                                            }
                                        </td>
                                    </>
                                )}

                                <td data-pending={!item.quoted_unit_price || !item.final_quantity}>
                                    {order.business_invoice_type === 'official' && item.product_tax_rate ?
                                        formatPrice(calculateItemTotal(item.quoted_unit_price, item.final_quantity, item.product_tax_rate)) :
                                        calculateTotal(item.quoted_unit_price, item.final_quantity)
                                    }
                                </td>

                                <td className="admin-notes" title={item.admin_notes}>
                                    {item.admin_notes ? (
                                        <div className="admin-note-content" style={{
                                            padding: '0.5rem',
                                            borderRadius: '4px',
                                            border: '1px solid #f59e0b',
                                            fontSize: '0.85rem'
                                        }}>
                                            {truncateText(item.admin_notes, 50)}
                                        </div>
                                    ) : (
                                        <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {/* Order Total Summary */}
                {order.quoted_total > 0 && (
                    <div className="neo-order-total-summary" style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        backgroundColor: '#f9fafb',
                        borderRadius: '8px',
                        border: '2px solid #e5e7eb'
                    }}>
                        <div className="total-breakdown">
                            <div className="total-item">
                                <span className="total-label">مجموع بدون مالیات:</span>
                                <span className="total-value">{formatPrice(order.quoted_total)}</span>
                            </div>
                            {order.business_invoice_type === 'official' && (
                                <>
                                    <div className="total-item">
                                        <span className="total-label">مالیات:</span>
                                        <span className="total-value">محاسبه می‌شود</span>
                                    </div>
                                    <div className="total-item total-final" style={{
                                        borderTop: '2px solid #374151',
                                        paddingTop: '0.5rem',
                                        fontWeight: 'bold',
                                        fontSize: '1.1rem'
                                    }}>
                                        <span className="total-label">مبلغ نهایی:</span>
                                        <span className="total-value">در فاکتور نهایی</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </NeoBrutalistCard>

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
                                disabled={submitting || generatingInvoice}
                                className="neo-approval-submit-btn"
                            />
                        </div>
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Upload Payment Receipt Section */}
            {order.status === 'confirmed' && (
                <NeoBrutalistCard className="neo-payment-upload-section">
                    <h2 className="neo-payment-title">آپلود رسید پرداخت</h2>
                    <p className="neo-payment-description">
                        لطفا رسید پرداخت خود را آپلود کنید تا فاکتور نهایی برای شما صادر شود.
                    </p>
                    <div className="neo-payment-upload-actions">
                        <NeoBrutalistButton
                            text="📤 آپلود رسید پرداخت"
                            color="green-400"
                            textColor="black"
                            onClick={() => {
                                console.log('Button clicked, opening modal'); // Debug log
                                setIsPaymentModalOpen(true);
                            }}
                            className="neo-upload-payment-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Fixed Modal - Make sure all props are correct */}
            {isPaymentModalOpen && (
                <PaymentReceiptUploadModal
                    orderId={orderId}
                    isOpen={isPaymentModalOpen}
                    onClose={() => {
                        console.log('Closing modal'); // Debug log
                        setIsPaymentModalOpen(false);
                    }}
                    onUploadSuccess={handlePaymentUploadSuccess}
                />
            )}

            {isCustomerInfoModalOpen && (
                <CustomerInfoManagement
                    onClose={() => setIsCustomerInfoModalOpen(false)}
                    onUpdate={handleCustomerInfoUpdate}
                    initialData={customerInfo}
                />
            )}
        </div>
    );
};

export default OrderDetailPage;