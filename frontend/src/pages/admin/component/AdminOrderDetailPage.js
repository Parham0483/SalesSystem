import React, { useState, useEffect, useRef } from 'react';
import API from '../../../component/api';
import DealerAssignmentComponent from '../../../component/DealerAssignmentComponent';
import PaymentVerificationComponent from "./PaymentVerificationComponent";
import NeoBrutalistCard from '../../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from '../../../component/NeoBrutalist/NeoBrutalistInput';
import '../../../styles/component/AdminComponent/AdminOrderDetail.css';
import AdminPricingEditSection from './AdminPricingEditSection';
import AdminMultiplePricingSection from './AdminMultiplePricingSection';


const formatPriceFixed = (price) => {
    if (price == null || isNaN(parseFloat(price))) return 'در انتظار';
    const numericPrice = parseFloat(price);
    return numericPrice > 0 ? `${new Intl.NumberFormat('fa-IR').format(numericPrice)} ریال` : 'در انتظار';
};

const formatQuantityFixed = (quantity) => {
    // Handle null, undefined, and zero values properly
    if (quantity === null || quantity === undefined || isNaN(quantity)) {
        return '';
    }

    const numericQuantity = parseInt(quantity);
    if (numericQuantity === 0) {
        return '';
    }

    try {
        return new Intl.NumberFormat('fa-IR').format(numericQuantity);
    } catch (error) {
        console.error('Admin quantity formatting error:', error, 'for quantity:', quantity);
        return numericQuantity.toString();
    }
};

// FIXED: Enhanced total calculation function for admin
const calculateTotalFixed = (unitPrice, quantity) => {
    if (!unitPrice || !quantity || unitPrice === 0 || quantity === 0) {
        return 'در انتظار';
    }
    const total = parseFloat(unitPrice) * parseInt(quantity);
    return formatPriceFixed(total).replace(' ریال', '');
};

const AdminInvoiceManager = ({ order, onUpdate }) => {
    const [loading, setLoading] = useState(false);
    const [invoiceStatus, setInvoiceStatus] = useState(null);
    const [loadingStatus, setLoadingStatus] = useState(false);

    useEffect(() => {
        if (order) {
            fetchInvoiceStatus();
        }
    }, [order]);

    const fetchInvoiceStatus = async () => {
        setLoadingStatus(true);
        try {
            const response = await API.get(`/orders/${order.id}/invoice-status/`);
            setInvoiceStatus(response.data);
        } catch (error) {
            console.error('Error fetching admin invoice status:', error);
            setInvoiceStatus({
                business_invoice_type_display: order.business_invoice_type === 'official' ? 'فاکتور رسمی' : 'فاکتور غیررسمی',
                quoted_total: order.quoted_total || 0,
                can_download_final_invoice: order.status === 'completed',
                final_invoice_available: order.status === 'completed',
                // NEW: Pre-invoice status fallbacks
                can_download_pre_invoice: order.status === 'waiting_customer_approval',
                pre_invoice_available: order.status === 'waiting_customer_approval',
                total_with_tax: null
            });
        } finally {
            setLoadingStatus(false);
        }
    };

    // NEW: Download pre-invoice function for admin
    const downloadPreInvoice = async () => {
        setLoading(true);
        try {
            const response = await API.get(`/orders/${order.id}/download-pre-invoice/`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `pre_invoice_${order.id}_${order.business_invoice_type}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Admin error downloading pre-invoice:', err);
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
            console.error('Admin error downloading final invoice:', err);
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
        return null; // Don't render if there's an error or no status
    }

    // NEW: Determine what type of invoice/document is available
    const getAvailableInvoiceType = () => {
        if (invoiceStatus.final_invoice_available && invoiceStatus.can_download_final_invoice) {
            return 'final';
        } else if (invoiceStatus.pre_invoice_available && invoiceStatus.can_download_pre_invoice) {
            return 'pre';
        }
        return null;
    };

    const availableInvoiceType = getAvailableInvoiceType();

    return (
        <NeoBrutalistCard className="neo-invoice-card" style={{ borderLeft: '6px solid #10b981' }}>
            <div className="neo-card-header">
                <h3 className="neo-card-title">مدیریت فاکتور (ادمین)</h3>
                <div className="neo-invoice-status-badges">
                    {/* NEW: Show pre-invoice badge when available */}
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
                    <span className="neo-info-label">نوع فاکتور</span>
                    <span className={`neo-info-value ${order.business_invoice_type === 'official' ? 'neo-official-invoice' : 'neo-unofficial-invoice'}`}>
                        {invoiceStatus.business_invoice_type_display}
                    </span>
                </div>
                <div className="neo-info-item">
                    <span className="neo-info-label">مبلغ کل</span>
                    <span className="neo-info-value neo-payable-amount">
                        {order.business_invoice_type === 'official' && invoiceStatus.total_with_tax ?
                            formatPriceFixed(invoiceStatus.total_with_tax) :
                            formatPriceFixed(invoiceStatus.quoted_total)
                        }
                    </span>
                </div>

                {/* NEW: Show invoice status and type */}
                <div className="neo-info-item">
                    <span className="neo-info-label">وضعیت سند</span>
                    <span className="neo-info-value">
                        {availableInvoiceType === 'final' ? '✅ فاکتور نهایی آماده' :
                            availableInvoiceType === 'pre' ? '📋 پیش‌فاکتور آماده' :
                                '⏳ در انتظار تولید سند'}
                    </span>
                </div>

                {order.status === 'completed' && (
                    <div className="neo-info-item">
                        <span className="neo-info-label">وضعیت</span>
                        <span className="neo-info-value" style={{ color: '#059669', fontWeight: 'bold' }}>
                             سفارش تکمیل شده
                        </span>
                    </div>
                )}
            </div>

            <div className="neo-invoice-actions">
                {/* NEW: Pre-invoice download section */}
                {invoiceStatus.can_download_pre_invoice && !invoiceStatus.final_invoice_available && (
                    <div className="neo-action-group">
                        <h4 className="neo-action-group-title">پیش‌فاکتور (معتبر تا پایان روز کاری)</h4>
                        <div className="neo-action-buttons">
                            <button
                                className="neo-btn neo-btn-secondary"
                                onClick={downloadPreInvoice}
                                disabled={loading}
                                style={{
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: '2px solid #1e40af'
                                }}
                            >
                                {loading ? 'در حال دانلود...' : '📋 دانلود پیش‌فاکتور'}
                            </button>
                        </div>
                        <div className="neo-info-note" style={{
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            marginTop: '0.5rem',
                            fontStyle: 'italic'
                        }}>
                            💡 پیش‌فاکتور برای بررسی و تأیید قیمت‌گذاری است
                        </div>
                    </div>
                )}

                {/* Final invoice download section */}
                {invoiceStatus.can_download_final_invoice && (
                    <div className="neo-action-group">
                        <h4 className="neo-action-group-title">
                            {availableInvoiceType === 'final' ? 'فاکتور نهایی' : 'فاکتور'}
                        </h4>
                        <div className="neo-action-buttons">
                            <button
                                className="neo-btn neo-btn-primary"
                                onClick={downloadFinalInvoice}
                                disabled={loading}
                            >
                                {loading ? 'در حال دانلود...' :
                                    availableInvoiceType === 'final' ? 'دانلود فاکتور نهایی' : 'دانلود فاکتور'}
                            </button>
                        </div>
                        {availableInvoiceType === 'final' && (
                            <div className="neo-info-note" style={{
                                fontSize: '0.875rem',
                                color: '#059669',
                                marginTop: '0.5rem',
                                fontWeight: 'bold'
                            }}>
                                ✅ فاکتور نهایی - پرداخت تأیید شده
                            </div>
                        )}
                    </div>
                )}

                {/* NEW: Show status when no invoice is available */}
                {!availableInvoiceType && (
                    <div className="neo-action-group">
                        <h4 className="neo-action-group-title">وضعیت فاکتور</h4>
                        <div className="neo-info-note" style={{
                            backgroundColor: '#fef3c7',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.9rem',
                            color: '#92400e',
                            border: '2px solid #f59e0b'
                        }}>
                            {order.status === 'pending_pricing' ? '⏳ در انتظار قیمت‌گذاری' :
                                order.status === 'confirmed' ? '📋 سفارش تأیید شده - آماده تولید فاکتور' :
                                    '⏳ فاکتور هنوز آماده نیست'}
                        </div>
                    </div>
                )}
            </div>
        </NeoBrutalistCard>
    );
};

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
                alert(response.data.message);
                if (onUpdate) {
                    onUpdate();
                }
            }
        } catch (err) {
            console.error('Error updating business invoice type:', err);
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
                            width: '100%'
                        }}
                    >
                        <option value="official">فاکتور رسمی</option>
                        <option value="unofficial">فاکتور غیررسمی</option>
                    </select>
                </div>

                <NeoBrutalistButton
                    text={updating ? "در حال به‌روزرسانی..." : "به‌روزرسانی نوع فاکتور"}
                    color="yellow-400"
                    textColor="black"
                    onClick={handleUpdateInvoiceType}
                    disabled={updating || order.status === 'completed'}
                    className="update-invoice-type-btn"
                />
            </div>
        </NeoBrutalistCard>
    );
};

const AdminCustomerInvoiceInfo = ({ order }) => {
    const getCustomerInvoiceInfo = () => {
        return order.customer_invoice_info || order.customer?.invoice_info;
    };

    return (
        <NeoBrutalistCard className="admin-customer-invoice-card" style={{ borderLeft: '6px solid #3b82f6' }}>
            <div className="admin-card-header">
                <h2 className="admin-card-title">اطلاعات فاکتور مشتری</h2>
            </div>
            <div className="admin-invoice-info-content">
                {order.business_invoice_type === 'unofficial' ? (
                    <div className="unofficial-invoice-message" style={{
                        textAlign: 'center',
                        padding: '1rem',
                        backgroundColor: '#eff6ff',
                        borderRadius: '6px',
                        color: '#1d4ed8',
                        border: '2px solid #3b82f6',
                        fontSize: '0.95rem'
                    }}>
                        <span>ℹ️ برای فاکتور غیررسمی، اطلاعات اضافی نیاز نیست</span>
                    </div>
                ) : (
                    <>
                        <div className="admin-customer-info-grid">
                            <div className="admin-info-item">
                                <span className="admin-info-label">کد ملی:</span>
                                <span className="admin-info-value">
                                    {getCustomerInvoiceInfo()?.national_id ||
                                        <span className="missing-info">ثبت نشده</span>}
                                </span>
                            </div>
                            <div className="admin-info-item">
                                <span className="admin-info-label">شناسه اقتصادی:</span>
                                <span className="admin-info-value">
                                    {getCustomerInvoiceInfo()?.economic_id ||
                                        <span className="missing-info">ثبت نشده</span>}
                                </span>
                            </div>
                            <div className="admin-info-item">
                                <span className="admin-info-label">کد پستی:</span>
                                <span className="admin-info-value">
                                    {getCustomerInvoiceInfo()?.postal_code ||
                                        <span className="missing-info">ثبت نشده</span>}
                                </span>
                            </div>
                            <div className="admin-info-item">
                                <span className="admin-info-label">نام شرکت:</span>
                                <span className="admin-info-value">
                                    {getCustomerInvoiceInfo()?.company_name ||
                                        <span className="missing-info">شخصی</span>}
                                </span>
                            </div>
                            <div className="admin-info-item full-width">
                                <span className="admin-info-label">آدرس کامل:</span>
                                <span className="admin-info-value">
                                    {getCustomerInvoiceInfo()?.complete_address ||
                                        <span className="missing-info">ثبت نشده</span>}
                                </span>
                            </div>
                        </div>

                        {/* Invoice readiness indicator */}
                        <div className="invoice-readiness" style={{ marginTop: '1rem' }}>
                            {(() => {
                                const info = getCustomerInvoiceInfo();
                                const isComplete = info?.national_id && info?.complete_address && info?.postal_code;
                                return isComplete ? (
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
                                        <span>⚠️ برخی اطلاعات فاکتور رسمی ناقص است</span>
                                    </div>
                                );
                            })()}
                        </div>
                    </>
                )}
            </div>
        </NeoBrutalistCard>
    );
};

const AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [completing, setCompleting] = useState(false);
    const isMounted = useRef(true);

    useEffect(() => {
        fetchOrder(true);
        return () => {
            isMounted.current = false;
        };
    }, [orderId]);

    const fetchOrder = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        setError(null);
        try {
            const response = await API.get(`/orders/${orderId}/`);
            console.log('Fetched order data:', JSON.stringify(response.data, null, 2));
            if (isMounted.current) {
                setOrder(response.data);
            }
        } catch (err) {
            console.error('Error fetching order:', err);
            setError('خطا در بارگیری سفارش');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleOrderUpdate = () => {
        fetchOrder(false);
        if (onOrderUpdated) onOrderUpdated();
    };

    const handleMajorStatusChange = () => {
        // Handle major status changes, e.g., reset to waiting approval
        fetchOrder(false);
        if (onOrderUpdated) onOrderUpdated();
    };

    const handleRemoveDealer = async () => {
        if (!window.confirm('آیا مطمئن هستید که می‌خواهید نماینده را حذف کنید?')) {
            return;
        }

        try {
            await API.post(`/orders/${order.id}/remove-dealer/`);
            alert('نماینده با موفقیت حذف شد');
            fetchOrder(false);
        } catch (err) {
            console.error('Error removing dealer:', err);
            alert(err.response?.data?.error || 'خطا در حذف نماینده');
        }
    };

    const handleCompleteOrder = async () => {
        setCompleting(true);
        try {
            const response = await API.post(`/orders/${order.id}/complete/`);
            if (response.status === 200) {
                alert('سفارش با موفقیت تکمیل شد!');
                fetchOrder(false);
            }
        } catch (err) {
            console.error('Error completing order:', err);
            alert(err.response?.data?.error || 'خطا در تکمیل سفارش');
        } finally {
            setCompleting(false);
        }
    };

    if (loading) {
        return <div className="admin-loading">در حال بارگیری سفارش...</div>;
    }

    if (error) {
        return <div className="admin-error">{error}</div>;
    }

    if (!order) {
        return <div className="admin-error">سفارش یافت نشد</div>;
    }

    return (
        <div className="admin-order-detail">
            {/* Order Header */}
            <div className="admin-order-header">
                <h1 className="admin-order-title">جزئیات سفارش #{order.id}</h1>
                <span className={`admin-status-badge status-${order.status}`}>
                    {order.status_display}
                </span>
            </div>

            {/* Order Info */}
            <NeoBrutalistCard className="admin-order-info-card">
                <div className="admin-card-header">
                    <h2 className="admin-card-title">اطلاعات سفارش</h2>
                </div>
                <div className="admin-order-info-grid">
                    <div className="admin-info-item">
                        <span className="admin-info-label">نام مشتری</span>
                        <span className="admin-info-value">{order.customer_name}</span>
                    </div>
                    <div className="admin-info-item">
                        <span className="admin-info-label">شماره تماس</span>
                        <span className="admin-info-value">{order.customer_phone}</span>
                    </div>
                    <div className="admin-info-item">
                        <span className="admin-info-label">تاریخ سفارش</span>
                        <span className="admin-info-value">
                            {new Date(order.created_at).toLocaleDateString('fa-IR')}
                        </span>
                    </div>
                    <div className="admin-info-item">
                        <span className="admin-info-label">مبلغ کل</span>
                        <span className="admin-info-value">{formatPriceFixed(order.quoted_total)}</span>
                    </div>
                    <div className="admin-info-item full-width">
                        <span className="admin-info-label">یادداشت مشتری</span>
                        {order.customer_comment && (
                            <p> {order.customer_comment}</p>
                        )}
                    </div>
                </div>
            </NeoBrutalistCard>

            {/* Invoice Manager */}
            <AdminInvoiceManager order={order} onUpdate={handleOrderUpdate} />

            {/* Customer Invoice Info */}
            <AdminCustomerInvoiceInfo order={order} />

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

            {order.status === 'pending_pricing' && (
                <AdminMultiplePricingSection
                    order={order}
                    onUpdate={handleOrderUpdate}
                    onOrderListRefresh={onOrderUpdated}
                />
            )}

            {/* Show AdminPricingEditSection for other statuses, including completed */}
            {(order.status === 'waiting_customer_approval' ||
                order.status === 'confirmed' ||
                order.status === 'payment_uploaded' ||
                order.status === 'completed') && (
                <AdminPricingEditSection
                    order={order}
                    onUpdate={handleOrderUpdate}
                    onOrderListRefresh={onOrderUpdated}
                    onMajorStatusChange={handleMajorStatusChange}
                    readOnly={order.status === 'completed'} // Optional: Make read-only for completed orders
                />
            )}

            {(order.status === 'payment_uploaded' || (order.status === 'completed' && order.has_payment_receipts)) && (
                <NeoBrutalistCard className="admin-payment-verification-card">
                    <div className="admin-card-header">
                        <h2 className="admin-card-title">
                            {order.status === 'completed' ? 'رسیدهای پرداخت تایید شده' : 'تایید پرداخت'}
                        </h2>
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
                                {order.status !== 'completed' && (
                                    <div className="admin-info-item">
                                        <span className="admin-info-label">تعداد رسیدها</span>
                                        <span className="admin-info-value">{order.payment_receipts_count || 'نامشخص'}</span>
                                    </div>
                                )}
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

                        {order.status === 'completed' && (
                            <div className="admin-info-item">
                                <span className="admin-info-label">وضعیت پرداخت</span>
                                <span className="admin-info-value" style={{ color: '#059669', fontWeight: 'bold' }}>
                                     تایید شده و تکمیل شده
                                </span>
                            </div>
                        )}
                    </div>

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

                    {order.status === 'completed' && (order.payment_receipt || order.has_payment_receipts) && (
                        <div className="completed-payment-message" style={{
                            backgroundColor: '#d1fae5',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            marginTop: '1rem',
                            color: '#059669',
                            border: '2px solid #059669',
                            textAlign: 'center',
                            fontSize: '0.9rem'
                        }}>
                            <span style={{ marginLeft: '0.5rem' }}>
                                ✅ پرداخت تایید شده و سفارش تکمیل شده
                            </span>
                        </div>
                    )}
                </NeoBrutalistCard>
            )}
        </div>
    );
};

export default AdminOrderDetailPage;