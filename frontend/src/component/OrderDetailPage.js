import React, { useState, useEffect, useRef } from 'react';
import API from './api';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import PaymentReceiptUploadModal from './PaymentReceiptUploadModal';
import CustomerInfoManagement from './CustomerInfoManagement';
import '../styles/component/CustomerComponent/OrderDetail.css';
import axios from 'axios';

const InvoiceManager = ({ order, onUpdate }) => {
    const [loading, setLoading] = useState(false);

    const handleInvoiceTypeChange = async (newType) => {
        if (!window.confirm(`آیا می‌خواهید نوع فاکتور را به "${newType === 'official' ? 'رسمی' : 'غیررسمی'}" تغییر دهید؟`)) {
            return;
        }

        setLoading(true);
        try {
            const response = await API.post(
                `/orders/${order.id}/update-business-invoice-type/`,
                { business_invoice_type: newType }
            );

            alert('نوع فاکتور با موفقیت تغییر یافت');
            onUpdate(); // Refresh parent component
        } catch (error) {
            alert('خطا در تغییر نوع فاکتور');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    function setError(خطادردانلودفاکتور) {
        
    }

    const downloadInvoice = async () => {
        try {
            // Use the order download endpoint instead of invoice endpoint
            const response = await API.get(`/orders/${order.id}/download-invoice/`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice_${order.id}_${order.business_invoice_type}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('❌ Error downloading invoice:', err);
            setError('خطا در دانلود فاکتور');
        }
    };

    const previewInvoice = async () => {
        setLoading(true);
        try {
            const response = await API.get(
                `/orders/${order.id}/preview-invoice/`,
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            window.open(url, '_blank');
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert('خطا در نمایش پیش‌نمایش فاکتور');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="neo-invoice-card">
            <div className="neo-card-header">
                <h3 className="neo-card-title">مدیریت فاکتور</h3>
            </div>

            <div className="neo-invoice-info-grid">
                <div className="neo-info-item">
                    <span className="neo-info-label">نوع فاکتور فعلی</span>
                    <span className={`neo-info-value ${order.business_invoice_type === 'official' ? 'neo-official-invoice' : 'neo-unofficial-invoice'}`}>
                        {order.business_invoice_type === 'official' ? 'فاکتور رسمی' : 'فاکتور غیررسمی'}
                    </span>
                </div>

                {order.business_invoice_type === 'official' && order.quoted_total && (
                    <div className="neo-info-item">
                        <span className="neo-info-label">مالیات (۹٪)</span>
                        <span className="neo-info-value neo-tax-badge">
                            {(order.quoted_total * 0.09).toLocaleString('fa-IR')} تومان
                        </span>
                    </div>
                )}
            </div>

            <div className="neo-invoice-actions">
                {order.status === 'completed' && (
                    <>
                        <button
                            className="neo-btn neo-btn-primary"
                            onClick={downloadInvoice}
                            disabled={loading}
                        >
                            {loading ? 'در حال دانلود...' : 'دانلود فاکتور'}
                        </button>

                        <button
                            className="neo-btn neo-btn-secondary"
                            onClick={previewInvoice}
                            disabled={loading}
                        >
                            {loading ? 'در حال بارگذاری...' : 'پیش‌نمایش فاکتور'}
                        </button>
                    </>
                )}

                {/* Admin only - change invoice type */}
                {window.userRole === 'admin' && order.status !== 'completed' && (
                    <div className="neo-invoice-type-controls">
                        <label className="neo-label">تغییر نوع فاکتور:</label>
                        <div className="neo-radio-group">
                            <label className="neo-radio-label">
                                <input
                                    type="radio"
                                    name={`invoiceType_${order.id}`}
                                    value="unofficial"
                                    checked={order.business_invoice_type === 'unofficial'}
                                    onChange={() => handleInvoiceTypeChange('unofficial')}
                                    disabled={loading}
                                />
                                <span className="neo-radio-text">غیررسمی</span>
                            </label>

                            <label className="neo-radio-label">
                                <input
                                    type="radio"
                                    name={`invoiceType_${order.id}`}
                                    value="official"
                                    checked={order.business_invoice_type === 'official'}
                                    onChange={() => handleInvoiceTypeChange('official')}
                                    disabled={loading}
                                />
                                <span className="neo-radio-text">رسمی</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {order.business_invoice_type === 'official' && (
                <div className="neo-invoice-requirements">
                    <h4 className="neo-requirements-title">الزامات فاکتور رسمی:</h4>
                    <ul className="neo-requirements-list">
                        <li>کد اقتصادی مشتری</li>
                        <li>کد پستی ۱۰ رقمی</li>
                        <li>نشانی کامل</li>
                        <li>محاسبه مالیات ۹٪</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

const AuthenticatedImage = ({ receipt, onError }) => {
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (receipt && receipt.file_type === 'image') {
            loadAuthenticatedImage();
        }
    }, [receipt]);

    const loadAuthenticatedImage = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('access_token');
            if (!token) {
                throw new Error('Authentication token not found');
            }

            const imageUrl = receipt.download_url;

            if (!imageUrl) {
                throw new Error('Download URL not available');
            }

            const response = await fetch(imageUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            setImageData(objectUrl);

        } catch (err) {
            console.error('❌ Error loading authenticated image:', err);
            setError(err.message);
            if (onError) {
                onError(err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (imageData) {
                URL.revokeObjectURL(imageData);
            }
        };
    }, [imageData]);

    if (loading) {
        return (
            <div className="neo-image-loading" style={{
                textAlign: 'center',
                padding: '20px',
                border: '2px dashed #ccc',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
            }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
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
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                    {error}
                </div>
                <button
                    onClick={loadAuthenticatedImage}
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
                alt={`رسید پرداخت ${receipt.file_name}`}
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
                onLoad={() => console.log('✅ Image rendered successfully')}
                onError={(e) => {
                    console.error('❌ Image render error:', e);
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
    }, [order]);

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
            console.log('✅ Order fetched:', response.data);
        } catch (err) {
            console.error('❌ Error fetching order:', err);
            setError('خطا در بارگیری جزئیات سفارش');
        } finally {
            setLoading(false);
        }
    };

    // Fetch customer info separately
    const fetchCustomerInfo = async () => {
        setLoadingCustomerInfo(true);
        try {
            const response = await API.get('/customers/invoice-info/');
            if (response.status === 200) {
                setCustomerInfo(response.data.customer_info);
                console.log('✅ Customer info fetched:', response.data.customer_info);
            }
        } catch (err) {
            console.error('❌ Error fetching customer info:', err);
            // Don't show error for missing customer info
        } finally {
            setLoadingCustomerInfo(false);
        }
    };

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

    const deletePaymentReceipt = async (receiptId) => {
        if (!window.confirm('آیا از حذف این رسید اطمینان دارید؟')) {
            return;
        }

        try {
            await API.delete(`/orders/${orderId}/delete-payment-receipt/${receiptId}/`);
            setPaymentReceipts(prev => prev.filter(receipt => receipt.id !== receiptId));
            fetchOrder();
            alert('رسید با موفقیت حذف شد');
        } catch (err) {
            console.error('❌ Error deleting payment receipt:', err);
            alert('خطا در حذف رسید پرداخت');
        }
    };

    const handleDownloadReceipt = async (receipt) => {
        try {
            const downloadUrl = receipt.download_url;

            if (!downloadUrl) {
                alert('لینک دانلود در دسترس نیست');
                return;
            }

            const token = localStorage.getItem('access_token');
            if (!token) {
                alert('لطفاً دوباره وارد شوید');
                return;
            }

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = receipt.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);

        } catch (error) {
            console.error('❌ Error downloading file:', error);
            alert('خطا در دانلود فایل');
        }
    };

    const handleViewPDF = async (receipt) => {
        try {
            const viewUrl = receipt.file_url;

            if (!viewUrl) {
                alert('فایل PDF در دسترس نیست');
                return;
            }

            const token = localStorage.getItem('access_token');
            if (!token) {
                alert('لطفاً دوباره وارد شوید');
                return;
            }

            const response = await fetch(viewUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const newWindow = window.open(blobUrl, '_blank');

            if (!newWindow) {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = receipt.file_name;
                link.click();
                URL.revokeObjectURL(blobUrl);
            } else {
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                }, 60000);
            }

        } catch (error) {
            console.error('❌ Error viewing PDF:', error);
            alert('خطا در مشاهده فایل PDF');
        }
    };

    const renderReceiptPreview = (receipt, index) => {
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
                            text=" مشاهده PDF"
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
        } finally {
            setSubmitting(false);
        }
    };

    const downloadInvoice = async () => {
        try {
            const response = await API.get(`/orders/${order.id}/download-invoice/`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice_${order.id}_${order.business_invoice_type}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('❌ Error downloading invoice:', err);
            setError('خطا در دانلود فاکتور');
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
        // Also refresh order to get updated customer info
        fetchOrder();
    };

    const getStatusColor = (status) => {
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
        return `${new Intl.NumberFormat('fa-IR').format(price)} ریال`;
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
        return `${new Intl.NumberFormat('fa-IR').format(total)} ریال`;
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

    // Function to determine if order needs official invoice info
    const isOfficialInvoice = () => {
        return order?.business_invoice_type === 'official';
    };

    //Check if customer info is complete
    const isCustomerInfoComplete = () => {
        if (!customerInfo || !isOfficialInvoice()) return true;

        const required = ['national_id', 'complete_address', 'postal_code'];
        return required.every(field => customerInfo[field] && customerInfo[field].trim() !== '');
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

                    {/* Invoice Type Display */}
                    <div className="neo-info-item">
                        <span className="neo-info-label">نوع فاکتور</span>
                        <span className={`neo-info-value ${isOfficialInvoice() ? 'neo-official-invoice' : 'neo-unofficial-invoice'}`}>
                            {order.business_invoice_type_display || (isOfficialInvoice() ? 'فاکتور رسمی' : 'فاکتور غیررسمی')}
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
                </div>
            </NeoBrutalistCard>

            {/* Invoice Manager Component */}
            {(order.status === 'completed' || window.userRole === 'admin') && (
                <InvoiceManager order={order} onUpdate={fetchOrder} />
            )}

            {/*Customer Invoice Information (for official invoices) */}
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
                                <span>🔄 در حال بارگیری اطلاعات...</span>
                            </div>
                        ) : (
                            <>
                                <div className="neo-info-grid">
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
                                    <div className="neo-info-item full-width">
                                        <span className="neo-info-label">آدرس کامل:</span>
                                        <span className="neo-info-value">{customerInfo?.complete_address || 'ثبت نشده'}</span>
                                    </div>
                                </div>

                                {/*Invoice readiness indicator */}
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
                                            <span>✅</span>
                                            <span>اطلاعات فاکتور رسمی کامل است</span>
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
                                                    {receipt.is_verified ? ' تایید شده' : ' در انتظار بررسی'}
                                                </span>
                                            </div>
                                        </div>

                                        {renderReceiptPreview(receipt, index)}
                                    </div>

                                    {/* Receipt actions */}
                                    <div className="neo-receipt-actions">
                                        <NeoBrutalistButton
                                            text=" دانلود"
                                            color="green-400"
                                            textColor="black"
                                            onClick={() => handleDownloadReceipt(receipt)}
                                            className="neo-download-receipt-btn"
                                        />

                                        {/* Allow deletion only if order is still in confirmed status */}
                                        {order.status === 'confirmed' && (
                                            <NeoBrutalistButton
                                                text="حذف"
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

            {/* Order Items Table */}
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

            {/* Payment Receipt Upload Section */}
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
                                text="آپلود رسیدهای پرداخت"
                                color="yellow-400"
                                textColor="black"
                                onClick={() => setIsPaymentModalOpen(true)}
                                className="neo-upload-receipt-btn"
                            />
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
                    <span>رسیدهای پرداخت شما آپلود شد و در انتظار بررسی توسط مدیر می‌باشد.</span>
                </div>
            )}

            {order.status === 'completed' && (
                <div className="neo-status-message neo-success">
                    <span>سفارش شما با موفقیت تکمیل شد! از خرید شما متشکریم.</span>
                </div>
            )}

            {/* Customer Info Management Modal */}
            {isCustomerInfoModalOpen && (
                <CustomerInfoManagement
                    onClose={() => setIsCustomerInfoModalOpen(false)}
                    onUpdate={handleCustomerInfoUpdate}
                />
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