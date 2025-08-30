// Enhanced DealerOrderDetailPage with step-by-step flow and improved styling
import React, { useState, useEffect, useRef } from 'react';
import API from './api';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from "./NeoBrutalist/NeoBrutalistInput";
import "../styles/component/DealerComponent/DealerOrderDetail.css"

// Enhanced AuthenticatedImage Component for Dealers
const AuthenticatedImage = ({ receipt, onError }) => {
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (receipt && receipt.file_type === 'image') {
            loadImage();
        }
    }, [receipt]);

    const loadImage = async () => {
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
                <button onClick={loadImage} style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}>
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
                onError={(e) => {
                    console.error('Image render error:', e);
                    setError('خطا در نمایش تصویر');
                }}
            />
        </div>
    );
};

const DealerOrderDetailPage = ({ orderId, onOrderUpdated }) => {
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dealerNotes, setDealerNotes] = useState('');
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [submittingNotes, setSubmittingNotes] = useState(false);
    const [debugInfo, setDebugInfo] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const [completedSteps, setCompletedSteps] = useState(new Set());

    // Payment receipts state
    const [paymentReceipts, setPaymentReceipts] = useState([]);
    const [loadingReceipts, setLoadingReceipts] = useState(false);
    const [receiptsError, setReceiptsError] = useState('');

    const tableRef = useRef(null);

    // Step definitions based on correct flow
    const getSteps = () => {
        const baseSteps = [
            { id: 1, title: 'بررسی اطلاعات سفارش', description: 'مشاهده جزئیات کلی سفارش' },
            { id: 2, title: 'بررسی اقلام سفارش', description: 'بررسی محصولات و قیمت‌ها' },
            { id: 3, title: 'یادداشت نماینده', description: 'ثبت یادداشت‌های مربوط به سفارش' }
        ];

        // Add payment receipts step only when customer has uploaded receipts
        if (order?.status === 'payment_uploaded' || order?.has_payment_receipts) {
            baseSteps.push({
                id: 4,
                title: 'بررسی رسیدهای پرداخت',
                description: 'مشاهده اسناد پرداخت ارسالی مشتری'
            });
        }

        baseSteps.push({
            id: baseSteps.length + 1,
            title: 'خلاصه نهایی',
            description: 'مرور کلی وضعیت سفارش'
        });

        return baseSteps;
    };

    useEffect(() => {
        console.log('DealerOrderDetailPage useEffect triggered with orderId:', orderId);
        if (orderId) {
            fetchOrder();
        } else {
            setLoading(false);
            setError('No orderId provided');
        }
    }, [orderId]);

    useEffect(() => {
        if (order?.items && tableRef.current) {
            applySmartTextSizing();
        }
    }, [order]);

    // Fetch payment receipts when order has them
    useEffect(() => {
        if (order && (order.status === 'payment_uploaded' || order.has_payment_receipts || order.payment_receipts?.length > 0)) {
            fetchPaymentReceipts();
        }
    }, [order]);

    const fetchOrder = async () => {
        console.log('fetchOrder: Starting for order ID:', orderId);
        setLoading(true);
        setError('');
        setDebugInfo(`Fetching order ${orderId}...`);

        try {
            const userDataString = localStorage.getItem('userData');
            const user = userDataString ? JSON.parse(userDataString) : null;
            const token = localStorage.getItem('access_token');

            console.log('Current user:', user);
            console.log('Token exists:', !!token);

            setDebugInfo(prev => prev + `\nUser: ${user?.name} (dealer: ${user?.is_dealer})`);
            setDebugInfo(prev => prev + `\nToken exists: ${!!token}`);

            let response;
            let usedEndpoint;

            try {
                console.log(`Trying dealer-specific endpoint: /dealers/order/${orderId}/`);
                setDebugInfo(prev => prev + `\n\nTrying: /dealers/order/${orderId}/`);
                response = await API.get(`/dealers/order/${orderId}/`);
                usedEndpoint = 'dealer-specific';
                console.log('Dealer-specific endpoint worked');
            } catch (dealerErr) {
                console.log('Dealer-specific endpoint failed:', dealerErr.response?.status);
                setDebugInfo(prev => prev + `\nDealer endpoint failed: ${dealerErr.response?.status || dealerErr.message}`);

                try {
                    console.log(`Trying general endpoint: /orders/${orderId}/`);
                    setDebugInfo(prev => prev + `\nTrying: /orders/${orderId}/`);
                    response = await API.get(`/orders/${orderId}/`);
                    usedEndpoint = 'general';
                    console.log('General orders endpoint worked');
                } catch (generalErr) {
                    console.log('General endpoint failed:', generalErr.response?.status);
                    setDebugInfo(prev => prev + `\nGeneral endpoint failed: ${generalErr.response?.status || generalErr.message}`);

                    console.log('Trying to find order in assigned orders list');
                    setDebugInfo(prev => prev + `\nTrying assigned orders list...`);
                    const assignedResponse = await API.get('/orders/my-assigned-orders/');
                    const assignedOrders = assignedResponse.data.orders || [];
                    const foundOrder = assignedOrders.find(o => o.id.toString() === orderId.toString());

                    if (foundOrder) {
                        console.log('Found order in assigned orders list');
                        response = { data: foundOrder };
                        usedEndpoint = 'assigned-list';
                    } else {
                        throw new Error('Order not found in any accessible endpoint');
                    }
                }
            }

            console.log('API Response:', response.status || 'from list', response.data);
            setDebugInfo(prev => prev + `\n\nResponse Status: ${response.status || 'from assigned list'}`);
            setDebugInfo(prev => prev + `\nUsed endpoint: ${usedEndpoint}`);
            setDebugInfo(prev => prev + `\nOrder ID: ${response.data?.id}`);
            setDebugInfo(prev => prev + `\nCustomer: ${response.data?.customer_name}`);
            setDebugInfo(prev => prev + `\nStatus: ${response.data?.status}`);

            setOrder(response.data);
            setDealerNotes(response.data.dealer_notes || '');

        } catch (err) {
            console.error('All endpoints failed:', err);
            handleFetchError(err);
        } finally {
            setLoading(false);
            console.log('fetchOrder: Completed');
        }
    };

    // Function to fetch payment receipts
    const fetchPaymentReceipts = async () => {
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

    const handleFetchError = (err) => {
        let errorDetails = `Error: ${err.message}`;

        if (err.response) {
            console.error('Response error:', err.response);
            errorDetails += `\nHTTP Status: ${err.response.status}`;
            errorDetails += `\nStatus Text: ${err.response.statusText}`;

            if (err.response.data) {
                errorDetails += `\nResponse Data: ${JSON.stringify(err.response.data, null, 2)}`;
            }

            switch (err.response.status) {
                case 401:
                    setError('خطای احراز هویت - لطفاً دوباره وارد شوید');
                    break;
                case 403:
                    setError('عدم دسترسی - شما اجازه مشاهده این سفارش را ندارید');
                    break;
                case 404:
                    setError('سفارش پیدا نشد یا به شما تخصیص داده نشده است');
                    break;
                case 500:
                    setError('خطای سرور');
                    break;
                default:
                    setError(`خطای HTTP: ${err.response.status}`);
            }
        } else {
            setError('خطای شبکه یا عدم پاسخ از سرور');
            errorDetails += '\nNo response received - Network error';
        }

        setDebugInfo(prev => prev + '\n\nFINAL ERROR:\n' + errorDetails);
    };

    const handleUpdateDealerNotes = async () => {
        setSubmittingNotes(true);
        setError('');

        try {
            console.log('Updating dealer notes for order:', orderId);
            const response = await API.post(`/orders/${orderId}/update-dealer-notes/`, {
                dealer_notes: dealerNotes
            });
            console.log('Notes updated successfully');
            alert('یادداشت‌های نماینده با موفقیت به‌روزرسانی شد');
            setIsEditingNotes(false);
            setCompletedSteps(prev => new Set([...prev, 3]));

            if (onOrderUpdated) {
                onOrderUpdated();
            }

            fetchOrder();

        } catch (err) {
            console.error('Error updating dealer notes:', err);
            if (err.response?.status === 403) {
                setError('شما اجازه ویرایش یادداشت‌های این سفارش را ندارید');
            } else {
                setError('خطا در به‌روزرسانی یادداشت‌ها');
            }
        } finally {
            setSubmittingNotes(false);
        }
    };


    // Enhanced PDF view function for dealers
    const handleViewPDF = async (receipt) => {
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

    // Receipt preview render function
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

    const formatPrice = (price) => {
        if (!price || price === 0 || price === '0') return 'در انتظار';

        try {
            const numericPrice = parseFloat(price);
            if (isNaN(numericPrice) || numericPrice === 0) return 'در انتظار';

            const formatted = numericPrice.toLocaleString('en-US');
            return `${formatted} ریال`;
        } catch (error) {
            return 'در انتظار';
        }
    };

    const formatQuantity = (quantity) => {
        if (quantity === null || quantity === undefined || quantity === '' || isNaN(quantity)) {
            return 'در انتظار';
        }

        try {
            const numericQuantity = parseInt(quantity);
            if (numericQuantity === 0) return 'در انتظار';

            return numericQuantity.toLocaleString('en-US');
        } catch (error) {
            return quantity.toString();
        }
    };

    const calculateTotal = (unitPrice, quantity) => {
        if (!unitPrice || !quantity || isNaN(unitPrice) || isNaN(quantity)) {
            return 'در انتظار';
        }

        try {
            const numericPrice = parseFloat(unitPrice);
            const numericQuantity = parseInt(quantity);

            if (numericPrice === 0 || numericQuantity === 0) {
                return 'در انتظار';
            }

            const total = numericPrice * numericQuantity;
            const formatted = total.toLocaleString('en-US');
            return `${formatted} ریال`;
        } catch (error) {
            return 'خطا در محاسبه';
        }
    };

    const calculateTaxAmount = (unitPrice, quantity, taxRate) => {
        if (!unitPrice || !quantity) return 'در انتظار';

        try {
            const numericPrice = parseFloat(unitPrice);
            const numericQuantity = parseInt(quantity);
            const numericTaxRate = parseFloat(taxRate) || 9;

            if (numericPrice === 0 || numericQuantity === 0) return 'در انتظار';

            const subtotal = numericPrice * numericQuantity;
            const taxAmount = subtotal * (numericTaxRate / 100);

            const formatted = taxAmount.toLocaleString('en-US');
            return `${formatted} ریال`;
        } catch (error) {
            return 'خطا در محاسبه';
        }
    };

    const calculateTotalWithTax = (unitPrice, quantity, taxRate) => {
        if (!unitPrice || !quantity) return 'در انتظار';

        try {
            const numericPrice = parseFloat(unitPrice);
            const numericQuantity = parseInt(quantity);
            const numericTaxRate = parseFloat(taxRate) || 9;

            if (numericPrice === 0 || numericQuantity === 0) return 'در انتظار';

            const subtotal = numericPrice * numericQuantity;
            const taxAmount = subtotal * (numericTaxRate / 100);
            const totalWithTax = subtotal + taxAmount;

            const formatted = totalWithTax.toLocaleString('en-US');
            return `${formatted} ریال`;
        } catch (error) {
            return 'خطا در محاسبه';
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

    const applySmartTextSizing = () => {
        const productCells = tableRef.current?.querySelectorAll('.dealer-table-cell:nth-child(1)');
        const notesCells = tableRef.current?.querySelectorAll('.dealer-table-cell:nth-child(3)');

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

    const truncateText = (text, maxLength = 30) => {
        if (!text) return '-';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    const goToStep = (stepId) => {
        setCurrentStep(stepId);
    };

    const completeStep = (stepId) => {
        setCompletedSteps(prev => new Set([...prev, stepId]));
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Step indicator component
    const StepIndicator = () => {
        const steps = getSteps();

        return (
            <div className="dealer-step-indicator">
                {steps.map((step, index) => (
                    <div
                        key={step.id}
                        className={`dealer-step ${
                            step.id === currentStep ? 'active' :
                                completedSteps.has(step.id) ? 'completed' : ''
                        }`}
                        onClick={() => goToStep(step.id)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div className="dealer-step-content">
                            <div className="dealer-step-title">{step.title}</div>
                            <div className="dealer-step-description">{step.description}</div>
                        </div>
                        {completedSteps.has(step.id) && (
                            <div className="dealer-step-check">✓</div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderStepContent = () => {
        const steps = getSteps();
        const hasPaymentStep = steps.some(step => step.title.includes('رسیدهای پرداخت'));

        switch (currentStep) {
            case 1:
                return renderOrderInfo();
            case 2:
                return renderOrderItems();
            case 3:
                return renderDealerNotes();
            case 4:
                return hasPaymentStep ? renderPaymentReceipts() : renderSummary();
            default:
                return renderSummary();
        }
    };

    const renderOrderInfo = () => (
        <NeoBrutalistCard className="dealer-step-card">
            <div className="dealer-card-header">
                <h2 className="dealer-card-title">اطلاعات کلی سفارش</h2>
            </div>
            <div className="dealer-order-info-grid">
                <div className="dealer-info-item">
                    <span className="dealer-info-label">مشتری</span>
                    <span className="dealer-info-value">{order.customer_name}</span>
                </div>
                <div className="dealer-info-item">
                    <span className="dealer-info-label">وضعیت</span>
                    <span className="dealer-info-value">{formatStatus(order.status)}</span>
                </div>
                <div className="dealer-info-item">
                    <span className="dealer-info-label">تاریخ</span>
                    <span className="dealer-info-value">
                        {new Date(order.created_at).toLocaleDateString('fa-IR')}
                    </span>
                </div>

                <div className="dealer-info-item">
                    <span className="dealer-info-label">نوع فاکتور</span>
                    <span className={`dealer-info-value ${order.business_invoice_type === 'official' ? 'neo-official-invoice' : 'neo-unofficial-invoice'}`}>
                        {order.business_invoice_type === 'official' ? (
                            <>
                                فاکتور رسمی
                                <span className="neo-tax-badge">دارای مالیات</span>
                            </>
                        ) : (
                            'فاکتور شخصی'
                        )}
                    </span>
                </div>

                {order.quoted_total && (
                    <div className="dealer-info-item">
                        <span className="dealer-info-label">مبلغ کل</span>
                        <span className="dealer-info-value">{formatPrice(order.quoted_total)}</span>
                    </div>
                )}
                {order.dealer_commission_amount && (
                    <div className="dealer-info-item">
                        <span className="dealer-info-label">کمیسیون شما</span>
                        <span className="dealer-info-value">{formatPrice(order.dealer_commission_amount)}</span>
                    </div>
                )}
                {order.effective_commission_rate && (
                    <div className="dealer-info-item">
                        <span className="dealer-info-label">نرخ کمیسیون</span>
                        <span className="dealer-info-value">{order.effective_commission_rate}%</span>
                    </div>
                )}
            </div>
            <div className="dealer-step-actions">
                <NeoBrutalistButton
                    text="بررسی اقلام سفارش ←"
                    color="blue-400"
                    textColor="white"
                    onClick={() => {
                        completeStep(1);
                        goToStep(2);
                    }}
                    className="dealer-next-btn"
                />
            </div>
        </NeoBrutalistCard>
    );

    const renderOrderItems = () => (
        <NeoBrutalistCard className="dealer-step-card">
            <div className="dealer-card-header">
                <h2 className="dealer-card-title">اقلام سفارش</h2>
            </div>
            <div
                className="dealer-items-table"
                ref={tableRef}
                data-invoice-type={order.business_invoice_type || 'unofficial'}
            >
                <div className="dealer-table-header">
                    <div className="dealer-header-cell">نام محصول</div>
                    <div className="dealer-header-cell">تعداد درخواستی</div>
                    <div className="dealer-header-cell">یادداشت مشتری</div>
                    <div className="dealer-header-cell">قیمت واحد</div>
                    <div className="dealer-header-cell">تعداد نهایی</div>

                    {order.business_invoice_type === 'official' && (
                        <>
                            <div className="dealer-header-cell">نرخ مالیات</div>
                            <div className="dealer-header-cell">مبلغ مالیات</div>
                        </>
                    )}

                    <div className="dealer-header-cell">مبلغ کل</div>
                </div>

                {order.items?.map((item, index) => (
                    <div key={index} className="dealer-table-row">
                        <div className="dealer-table-cell" data-label="محصول" title={item.product_name} data-pending={!item.product_name}>
                            {item.product_name || 'نامشخص'}
                        </div>
                        <div className="dealer-table-cell" data-label="تعداد درخواستی">
                            {formatQuantity(item.requested_quantity)}
                        </div>
                        <div className="dealer-table-cell" data-label="یادداشت مشتری" title={item.customer_notes} data-pending={!item.customer_notes}>
                            {truncateText(item.customer_notes) || '-'}
                        </div>
                        <div className="dealer-table-cell" data-label="قیمت واحد" data-pending={!item.quoted_unit_price}>
                            {formatPrice(item.quoted_unit_price)}
                        </div>
                        <div className="dealer-table-cell" data-label="تعداد نهایی" data-pending={!item.final_quantity}>
                            {formatQuantity(item.final_quantity)}
                        </div>

                        {order.business_invoice_type === 'official' && (
                            <>
                                <div className="dealer-table-cell" data-label="نرخ مالیات">
                                    {item.product_tax_rate ? `${parseFloat(item.product_tax_rate).toFixed(1)}%` : '9%'}
                                </div>
                                <div className="dealer-table-cell" data-label="مبلغ مالیات">
                                    {calculateTaxAmount(item.quoted_unit_price, item.final_quantity, item.product_tax_rate || 9)}
                                </div>
                            </>
                        )}

                        <div className="dealer-table-cell" data-label="مبلغ کل" data-pending={!item.quoted_unit_price || !item.final_quantity}>
                            {order.business_invoice_type === 'official' ?
                                calculateTotalWithTax(item.quoted_unit_price, item.final_quantity, item.product_tax_rate || 9) :
                                calculateTotal(item.quoted_unit_price, item.final_quantity)
                            }
                        </div>
                    </div>
                ))}
            </div>
            <div className="dealer-step-actions">
                <NeoBrutalistButton
                    text="→ بازگشت"
                    color="gray-400"
                    textColor="black"
                    onClick={() => goToStep(1)}
                    className="dealer-back-btn"
                />
                <NeoBrutalistButton
                    text="یادداشت نماینده ←"
                    color="blue-400"
                    textColor="white"
                    onClick={() => {
                        completeStep(2);
                        goToStep(3);
                    }}
                    className="dealer-next-btn"
                />
            </div>
        </NeoBrutalistCard>
    );

    const renderDealerNotes = () => (
        <NeoBrutalistCard className="dealer-step-card">
            <div className="dealer-card-header">
                <h2 className="dealer-card-title">یادداشت‌های نماینده</h2>
                <NeoBrutalistButton
                    text={isEditingNotes ? 'لغو' : 'ویرایش'}
                    color={isEditingNotes ? 'red-400' : 'green-400'}
                    textColor={isEditingNotes ? 'white' : 'black'}
                    onClick={() => {
                        setIsEditingNotes(!isEditingNotes);
                        if (isEditingNotes) {
                            setDealerNotes(order.dealer_notes || '');
                        }
                    }}
                />
            </div>

            {isEditingNotes ? (
                <div className="dealer-notes-edit">
                    <textarea
                        value={dealerNotes}
                        onChange={(e) => setDealerNotes(e.target.value)}
                        placeholder="یادداشت‌های شما در مورد این سفارش..."
                        rows={4}
                        className="dealer-notes-textarea"
                    />
                    <div className="dealer-notes-actions">
                        <NeoBrutalistButton
                            text={submittingNotes ? 'در حال ذخیره...' : 'ذخیره یادداشت'}
                            color="green-400"
                            textColor="black"
                            onClick={handleUpdateDealerNotes}
                            disabled={submittingNotes}
                            className="dealer-save-notes-btn"
                        />
                    </div>
                </div>
            ) : (
                <div className="dealer-notes-display">
                    {order.dealer_notes || 'هنوز یادداشتی ثبت نشده است.'}
                </div>
            )}

            <div className="dealer-step-actions">
                <NeoBrutalistButton
                    text="→ بازگشت"
                    color="gray-400"
                    textColor="black"
                    onClick={() => goToStep(2)}
                    className="dealer-back-btn"
                />
                <NeoBrutalistButton
                    text={order.status === 'payment_uploaded' || order.has_payment_receipts ? 'بررسی رسیدها ←' : 'خلاصه نهایی ←'}
                    color="blue-400"
                    textColor="white"
                    onClick={() => {
                        completeStep(3);
                        const steps = getSteps();
                        const hasPaymentStep = steps.some(step => step.title.includes('رسیدهای پرداخت'));
                        goToStep(hasPaymentStep ? 4 : steps.length);
                    }}
                    className="dealer-next-btn"
                />
            </div>
        </NeoBrutalistCard>
    );

    // Payment receipts render function for dealers
    const renderPaymentReceipts = () => (
        <NeoBrutalistCard className="dealer-step-card">
            <div className="dealer-card-header">
                <h2 className="dealer-card-title">رسیدهای پرداخت مشتری</h2>
                {loadingReceipts && <span>در حال بارگیری...</span>}
            </div>

            {receiptsError && (
                <div className="dealer-error-message">
                    <span>{receiptsError}</span>
                </div>
            )}

            <div className="dealer-receipts-content">
                <div className="dealer-receipts-info">
                    <p>مشتری {paymentReceipts.length} رسید پرداخت آپلود کرده است:</p>
                </div>

                {paymentReceipts.length > 0 ? (
                    <div className="dealer-receipts-grid">
                        {paymentReceipts.map((receipt, index) => (
                            <div key={receipt.id} className="dealer-receipt-item" data-file-type={receipt.file_type}>
                                <div className="dealer-receipt-header">
                                    <h4>رسید {index + 1}</h4>
                                    <div className="dealer-receipt-meta">
                                        <span className="dealer-receipt-type">
                                            {receipt.file_type === 'pdf' ? 'PDF' : 'تصویر'}
                                        </span>
                                        <span className="dealer-receipt-size">
                                            {formatFileSize(receipt.file_size)}
                                        </span>
                                    </div>
                                </div>

                                <div className="dealer-receipt-info">
                                    <div className="dealer-receipt-details">
                                        <div className="dealer-info-item">
                                            <span className="dealer-info-label">نام فایل:</span>
                                            <span className="dealer-info-value">{receipt.file_name}</span>
                                        </div>
                                        <div className="dealer-info-item">
                                            <span className="dealer-info-label">تاریخ آپلود:</span>
                                            <span className="dealer-info-value">
                                                {new Date(receipt.uploaded_at).toLocaleDateString('fa-IR')}
                                            </span>
                                        </div>
                                        <div className="dealer-info-item">
                                            <span className="dealer-info-label">وضعیت:</span>
                                            <span className={`dealer-info-value ${
                                                receipt.is_verified ? 'dealer-receipt-verified' : 'dealer-receipt-pending'
                                            }`}>
                                                {receipt.is_verified ? 'تایید شده' : 'در انتظار بررسی'}
                                            </span>
                                        </div>
                                    </div>

                                    {renderReceiptPreview(receipt, index)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="dealer-no-receipts">
                        <p>هنوز رسید پرداختی آپلود نشده است.</p>
                    </div>
                )}

                <div className="dealer-payment-summary">
                    <div className="dealer-summary-stats">
                        <div className="dealer-stat-item">
                            <span className="dealer-stat-label">کل رسیدها:</span>
                            <span className="dealer-stat-value">{paymentReceipts.length}</span>
                        </div>
                        <div className="dealer-stat-item">
                            <span className="dealer-stat-label">تایید شده:</span>
                            <span className="dealer-stat-value">
                                {paymentReceipts.filter(r => r.is_verified).length}
                            </span>
                        </div>
                        <div className="dealer-stat-item">
                            <span className="dealer-stat-label">در انتظار:</span>
                            <span className="dealer-stat-value">
                                {paymentReceipts.filter(r => !r.is_verified).length}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="dealer-step-actions">
                <NeoBrutalistButton
                    text="→ بازگشت"
                    color="gray-400"
                    textColor="black"
                    onClick={() => goToStep(3)}
                    className="dealer-back-btn"
                />
                <NeoBrutalistButton
                    text="خلاصه نهایی ←"
                    color="blue-400"
                    textColor="white"
                    onClick={() => {
                        completeStep(4);
                        goToStep(getSteps().length);
                    }}
                    className="dealer-next-btn"
                />
            </div>
        </NeoBrutalistCard>
    );

    const renderSummary = () => (
        <NeoBrutalistCard className="dealer-step-card">
            <div className="dealer-card-header">
                <h2 className="dealer-card-title">خلاصه وضعیت سفارش</h2>
            </div>
            <div className="dealer-summary-content">
                <div className="dealer-summary-item">
                    <span className="dealer-summary-label">سفارش #</span>
                    <span className="dealer-summary-value">{order.id}</span>
                </div>
                <div className="dealer-summary-item">
                    <span className="dealer-summary-label">مشتری</span>
                    <span className="dealer-summary-value">{order.customer_name}</span>
                </div>
                <div className="dealer-summary-item">
                    <span className="dealer-summary-label">وضعیت فعلی</span>
                    <span className="dealer-summary-value">{formatStatus(order.status)}</span>
                </div>

                {/* Show appropriate summary based on order status */}
                {order.status === 'pending_pricing' && (
                    <div className="dealer-status-message">
                        <span className="dealer-status-info">سفارش در انتظار قیمت‌گذاری توسط ادمین است</span>
                    </div>
                )}

                {order.status === 'waiting_customer_approval' && (
                    <div className="dealer-status-message">
                        <span className="dealer-status-info">سفارش در انتظار تایید مشتری است</span>
                    </div>
                )}

                {order.status === 'confirmed' && (
                    <div className="dealer-status-message">
                        <span className="dealer-status-success">سفارش تایید شد - مشتری باید رسید پرداخت آپلود کند</span>
                    </div>
                )}

                {order.status === 'payment_uploaded' && (
                    <div className="dealer-status-message">
                        <span className="dealer-status-info">رسیدهای پرداخت آپلود شده - در انتظار بررسی ادمین</span>
                    </div>
                )}

                {order.status === 'completed' && (
                    <div className="dealer-status-message">
                        <span className="dealer-status-success">سفارش تکمیل شد! کمیسیون شما محاسبه شده است</span>
                    </div>
                )}

                {order.status === 'rejected' && (
                    <div className="dealer-status-message">
                        <span className="dealer-status-error">سفارش رد شده توسط مشتری</span>
                        {order.customer_rejection_reason && (
                            <div className="dealer-rejection-reason">
                                <strong>دلیل رد:</strong> {order.customer_rejection_reason}
                            </div>
                        )}
                    </div>
                )}

                <div className="dealer-summary-item">
                    <span className="dealer-summary-label">تعداد اقلام</span>
                    <span className="dealer-summary-value">{order.items?.length || 0}</span>
                </div>
                {order.quoted_total > 0 && (
                    <div className="dealer-summary-item">
                        <span className="dealer-summary-label">مبلغ کل</span>
                        <span className="dealer-summary-value">{formatPrice(order.quoted_total)}</span>
                    </div>
                )}
                {order.dealer_commission_amount > 0 && (
                    <div className="dealer-summary-item highlight">
                        <span className="dealer-summary-label">کمیسیون شما</span>
                        <span className="dealer-summary-value">{formatPrice(order.dealer_commission_amount)}</span>
                    </div>
                )}
                {order.dealer_notes && (
                    <div className="dealer-summary-notes">
                        <span className="dealer-summary-label">یادداشت شما:</span>
                        <span className="dealer-summary-value">{order.dealer_notes}</span>
                    </div>
                )}
            </div>
            <div className="dealer-step-actions">
                <NeoBrutalistButton
                    text="→ بازگشت به مرحله قبل"
                    color="gray-400"
                    textColor="black"
                    onClick={() => goToStep(getSteps().length - 1)}
                    className="dealer-back-btn"
                />
                <NeoBrutalistButton
                    text="بازگشت به داشبورد"
                    color="yellow-400"
                    textColor="black"
                    onClick={() => window.history.back()}
                    className="dealer-dashboard-btn"
                />
            </div>
        </NeoBrutalistCard>
    );

    if (loading) {
        return (
            <div className="dealer-order-detail">
                <NeoBrutalistCard className="dealer-loading-card">
                    <div className="dealer-loading-content">
                        <span className="dealer-loading-text">در حال بارگذاری جزئیات سفارش...</span>
                        <p>Order ID: {orderId}</p>

                        <div className="dealer-debug-info">
                            <details>
                                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Debug Log</summary>
                                <div className="dealer-debug-content">
                                    {debugInfo || 'Initializing...'}
                                </div>
                            </details>

                            <NeoBrutalistButton
                                text="تلاش مجدد"
                                color="blue-400"
                                textColor="white"
                                onClick={() => fetchOrder()}
                                className="dealer-retry-btn"
                            />
                        </div>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dealer-order-detail">
                <NeoBrutalistCard className="dealer-error-card">
                    <div className="dealer-error-content">
                        <h2>خطا در بارگذاری سفارش</h2>
                        <p className="dealer-error-text">{error}</p>

                        <div className="dealer-debug-info">
                            <details>
                                <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Technical Details</summary>
                                <div className="dealer-debug-content">
                                    {debugInfo}
                                </div>
                            </details>
                        </div>

                        <div className="dealer-error-actions">
                            <NeoBrutalistButton
                                text="تلاش مجدد"
                                color="blue-400"
                                textColor="white"
                                onClick={() => fetchOrder()}
                                className="dealer-retry-btn"
                            />
                            <NeoBrutalistButton
                                text="بازگشت"
                                color="gray-400"
                                textColor="black"
                                onClick={() => window.history.back()}
                                className="dealer-back-btn"
                            />
                        </div>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="dealer-order-detail">
                <NeoBrutalistCard className="dealer-error-card">
                    <div className="dealer-error-content">
                        <h2>سفارش پیدا نشد</h2>
                        <p>Order ID: {orderId}</p>

                        <div className="dealer-error-actions">
                            <NeoBrutalistButton
                                text="تلاش مجدد"
                                color="blue-400"
                                textColor="white"
                                onClick={() => fetchOrder()}
                                className="dealer-retry-btn"
                            />
                            <NeoBrutalistButton
                                text="بازگشت"
                                color="gray-400"
                                textColor="black"
                                onClick={() => window.history.back()}
                                className="dealer-back-btn"
                            />
                        </div>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    return (
        <div className="dealer-order-detail">
            <div className="dealer-order-header">
                <h1 className="dealer-order-title">سفارش #{order.id}</h1>
                <div className="dealer-status-badge">
                    <span className={`dealer-status ${order.status}`}>
                        {formatStatus(order.status)}
                    </span>
                </div>
            </div>

            <StepIndicator />

            {error && (
                <div className="dealer-error-message">
                    <span>{error}</span>
                </div>
            )}

            {renderStepContent()}
        </div>
    );
};

export default DealerOrderDetailPage;