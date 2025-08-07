import React, { useState, useEffect } from 'react';
import API from './api';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistDropdown from './NeoBrutalist/NeoBrutalistDropdown';
import '../styles/component/CustomerComponent/CreateOrder.css';

const CreateOrderPage = ({ onOrderCreated }) => {
    const [products, setProducts] = useState([]);
    const [customerComment, setCustomerComment] = useState('');
    const [orderItems, setOrderItems] = useState([{ product: '', requested_quantity: 1, customer_notes: '' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Business invoice type state - default to unofficial
    const [needsOfficialInvoice, setNeedsOfficialInvoice] = useState(false);

    // Customer info states
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: '',
        company_name: '',
        national_id: '',
        economic_id: '',
        postal_code: '',
        complete_address: '',
        province: '',
        city: ''
    });
    const [customerInfoLoaded, setCustomerInfoLoaded] = useState(false);
    const [customerInfoErrors, setCustomerInfoErrors] = useState({});
    const [loadingCustomerInfo, setLoadingCustomerInfo] = useState(false);

    useEffect(() => {
        fetchProducts();
        loadCustomerInfo();
    }, []);

    // Show customer form when official invoice is requested
    useEffect(() => {
        if (needsOfficialInvoice) {
            if (customerInfoLoaded) {
                checkCustomerInfoCompleteness();
            }
        } else {
            setCustomerInfoErrors({});
        }
    }, [needsOfficialInvoice, customerInfo, customerInfoLoaded]);

    const fetchProducts = async () => {
        try {
            const response = await API.get('/products/');
            setProducts(response.data);
        } catch (err) {
            setError('خطا در بارگیری محصولات');
        }
    };

    const loadCustomerInfo = async () => {
        setLoadingCustomerInfo(true);
        try {
            const response = await API.get('/customers/invoice-info/');
            if (response.status === 200) {
                setCustomerInfo(response.data.customer_info);
                setCustomerInfoLoaded(true);
                console.log('✅ Customer info loaded:', response.data.customer_info);
            }
        } catch (err) {
            console.error('❌ Error loading customer info:', err);
            // Don't show error for missing customer info - it's expected for new users
        } finally {
            setLoadingCustomerInfo(false);
        }
    };

    const checkCustomerInfoCompleteness = () => {
        const required = ['name', 'phone', 'complete_address', 'national_id', 'postal_code', 'province', 'city'];
        const errors = {};

        required.forEach(field => {
            if (!customerInfo[field] || customerInfo[field].trim() === '') {
                const labels = {
                    name: 'نام کامل',
                    phone: 'شماره تماس',
                    complete_address: 'آدرس کامل',
                    national_id: 'کد ملی',
                    postal_code: 'کد پستی',
                    province: 'استان',
                    city: 'شهر'
                };
                errors[field] = `${labels[field]} الزامی است`;
            }
        });

        // Validate formats
        if (customerInfo.national_id && customerInfo.national_id.length < 8) {
            errors.national_id = 'کد ملی باید حداقل 8 رقم باشد';
        }
        if (customerInfo.postal_code && (customerInfo.postal_code.length !== 10 || !/^\d+$/.test(customerInfo.postal_code))) {
            errors.postal_code = 'کد پستی باید دقیقاً 10 رقم باشد';
        }
        if (customerInfo.phone && !/^09\d{9}$/.test(customerInfo.phone)) {
            errors.phone = 'شماره تماس باید با 09 شروع شده و 11 رقم باشد';
        }

        setCustomerInfoErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCustomerInfoChange = (field, value) => {
        setCustomerInfo(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error for this field
        if (customerInfoErrors[field]) {
            setCustomerInfoErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const updateCustomerInfo = async () => {
        try {
            const response = await API.post('/customers/update-invoice-info/', {
                invoice_type: needsOfficialInvoice ? 'official' : 'unofficial',
                customer_info: customerInfo
            });

            if (response.status === 200) {
                console.log('✅ Customer info updated successfully');
                return true;
            }
        } catch (err) {
            console.error('❌ Error updating customer info:', err);
            if (err.response?.data?.details) {
                setCustomerInfoErrors(err.response.data.details);
            } else {
                setError('خطا در به‌روزرسانی اطلاعات مشتری');
            }
            return false;
        }
    };

    const addOrderItem = () => {
        setOrderItems([...orderItems, { product: '', requested_quantity: 1, customer_notes: '' }]);
    };

    const removeOrderItem = (index) => {
        if (orderItems.length > 1) {
            setOrderItems(orderItems.filter((_, i) => i !== index));
        }
    };

    const updateOrderItem = (index, field, value) => {
        const updatedItems = orderItems.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        );
        setOrderItems(updatedItems);
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            // Validate items
            const validItems = orderItems.filter(item =>
                item.product && item.requested_quantity > 0
            );

            if (validItems.length === 0) {
                throw new Error('لطفاً حداقل یک محصول به سفارش اضافه کنید');
            }

            // Check customer info for official invoices
            if (needsOfficialInvoice) {
                const isInfoComplete = checkCustomerInfoCompleteness();
                if (!isInfoComplete) {
                    throw new Error('لطفاً اطلاعات مورد نیاز برای فاکتور رسمی را تکمیل کنید');
                }
            }

            // Prepare order data
            const orderData = {
                customer_comment: customerComment,
                business_invoice_type: needsOfficialInvoice ? 'official' : 'unofficial',
                items: validItems.map(item => ({
                    product_id: parseInt(item.product),
                    quantity: parseInt(item.requested_quantity),
                    customer_notes: item.customer_notes || ''
                }))
            };

            // ADD CUSTOMER INFO FOR OFFICIAL INVOICES
            if (needsOfficialInvoice) {
                orderData.customer_info = {
                    name: customerInfo.name,
                    phone: customerInfo.phone,
                    company_name: customerInfo.company_name || '',
                    national_id: customerInfo.national_id,
                    economic_id: customerInfo.economic_id || '',
                    postal_code: customerInfo.postal_code,
                    complete_address: customerInfo.complete_address,
                    province: customerInfo.province || '',
                    city: customerInfo.city || ''
                };
            }

            console.log('📤 Sending order data:', orderData);

            const response = await API.post('orders/', orderData);

            if (response.status === 201) {
                console.log('✅ Order created successfully:', response.data);

                // Show success message
                alert(`سفارش با موفقیت ثبت شد!\nشماره سفارش: ${response.data.id}`);

                if (onOrderCreated) {
                    onOrderCreated();
                }
            }
        } catch (err) {
            console.error('❌ Order creation failed:', err);
            setError(err.response?.data?.error || err.message || 'خطا در ثبت سفارش');
        } finally {
            setLoading(false);
        }
    };

    const productOptions = products.map(product => ({
        value: product.id.toString(),
        label: `${product.name} - ${product.base_price} تومان`
    }));

    const getUserInfo = () => {
        const userDataString = localStorage.getItem('userData');
        return userDataString ? JSON.parse(userDataString) : null;
    };

    const userInfo = getUserInfo();

    return (
        <div className="neo-create-order" dir="rtl">
            <div className="neo-create-order-header">
                <h1 className="neo-create-order-title">ثبت سفارش جدید</h1>
                {userInfo && (
                    <div className="neo-customer-info">
                        <span className="neo-customer-label">مشتری:</span>
                        <span className="neo-customer-name">{userInfo.name}</span>
                    </div>
                )}
            </div>

            {error && (
                <NeoBrutalistCard className="neo-error-card">
                    <div className="neo-error-content">
                        <span className="neo-error-icon">⚠️</span>
                        <span className="neo-error-text">{error}</span>
                    </div>
                </NeoBrutalistCard>
            )}

            <div className="neo-order-form">
                {/* Invoice Type Selection - Single Checkbox */}
                <NeoBrutalistCard className="neo-invoice-type-section">
                    <h3>نوع فاکتور</h3>
                    <div className="neo-invoice-type-selection">

                        <div className="neo-checkbox-group">
                            <label className="neo-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={needsOfficialInvoice}
                                    onChange={(e) => setNeedsOfficialInvoice(e.target.checked)}
                                    className="neo-checkbox-input"
                                />
                                <span className="neo-checkbox-text">
                                    <strong>نیاز به فاکتور رسمی دارم</strong>
                                    <br />
                                    <small>با مالیات - برای ثبت در حسابداری شرکت</small>
                                </span>
                            </label>
                        </div>
                    </div>
                </NeoBrutalistCard>

                {/* Customer Information Form (for official invoices) */}
                {needsOfficialInvoice && (
                    <NeoBrutalistCard className="neo-customer-form-section">
                        <div className="neo-customer-form-header">
                            <h3>اطلاعات مورد نیاز برای فاکتور رسمی</h3>
                            {loadingCustomerInfo && (
                                <span className="neo-loading-text">🔄 در حال بارگیری اطلاعات...</span>
                            )}
                        </div>

                        <div className="neo-customer-form">
                            <div className="neo-form-row">
                                <div className="neo-form-field">
                                    <NeoBrutalistInput
                                        label="نام کامل *"
                                        value={customerInfo.name}
                                        onChange={(e) => handleCustomerInfoChange('name', e.target.value)}
                                        error={customerInfoErrors.name}
                                        placeholder="نام ونام خانوادگی"
                                    />
                                </div>
                                <div className="neo-form-field">
                                    <NeoBrutalistInput
                                        label="شماره تماس *"
                                        value={customerInfo.phone}
                                        onChange={(e) => handleCustomerInfoChange('phone', e.target.value)}
                                        error={customerInfoErrors.phone}
                                        placeholder="شماره تماس"
                                    />
                                </div>
                            </div>

                            <div className="neo-form-row">
                                <div className="neo-form-field">
                                    <NeoBrutalistInput
                                        label="نام شرکت (اختیاری)"
                                        value={customerInfo.company_name}
                                        onChange={(e) => handleCustomerInfoChange('company_name', e.target.value)}
                                        placeholder="نام شرکت"
                                    />
                                </div>
                                <div className="neo-form-field">
                                    <NeoBrutalistInput
                                        label="شناسه ملی *"
                                        value={customerInfo.national_id}
                                        onChange={(e) => handleCustomerInfoChange('national_id', e.target.value)}
                                        error={customerInfoErrors.national_id}
                                        placeholder="شناسه ملی"
                                        maxLength="10"
                                    />
                                </div>
                            </div>

                            <div className="neo-form-row">
                                <div className="neo-form-field">
                                    <NeoBrutalistInput
                                        label="شناسه اقتصادی"
                                        value={customerInfo.economic_id}
                                        onChange={(e) => handleCustomerInfoChange('economic_id', e.target.value)}
                                        placeholder="شناسه اقتصادی"
                                    />
                                </div>
                                <div className="neo-form-field">
                                    <NeoBrutalistInput
                                        label="کد پستی *"
                                        value={customerInfo.postal_code}
                                        onChange={(e) => handleCustomerInfoChange('postal_code', e.target.value)}
                                        error={customerInfoErrors.postal_code}
                                        placeholder="کد پستی"
                                        maxLength="10"
                                    />
                                </div>
                            </div>

                            <div className="neo-form-row">
                                <div className="neo-form-field">
                                    <NeoBrutalistInput
                                        label="استان *"
                                        value={customerInfo.province}
                                        onChange={(e) => handleCustomerInfoChange('province', e.target.value)}
                                        error={customerInfoErrors.province}
                                        placeholder="استان"
                                    />
                                </div>
                                <div className="neo-form-field">
                                    <NeoBrutalistInput
                                        label="شهر *"
                                        value={customerInfo.city}
                                        onChange={(e) => handleCustomerInfoChange('city', e.target.value)}
                                        error={customerInfoErrors.city}
                                        placeholder="شهر"
                                    />
                                </div>
                            </div>

                            <div className="neo-form-row">
                                <div className="neo-textarea-group">
                                    <label className="neo-textarea-label">آدرس کامل *</label>
                                    <textarea
                                        className={`neo-textarea ${customerInfoErrors.complete_address ? 'error' : ''}`}
                                        value={customerInfo.complete_address}
                                        onChange={(e) => handleCustomerInfoChange('complete_address', e.target.value)}
                                        placeholder="مثال: تهران، خیابان آزادی، پلاک 123، طبقه 2"
                                        rows={3}
                                    />
                                    {customerInfoErrors.complete_address && (
                                        <span className="neo-error-text">{customerInfoErrors.complete_address}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {Object.keys(customerInfoErrors).length > 0 && (
                            <div className="neo-form-errors">
                                <span className="neo-error-icon">⚠️</span>
                                <span>لطفاً فیلدهای الزامی را تکمیل کنید</span>
                            </div>
                        )}
                    </NeoBrutalistCard>
                )}

                {/* Order Items Section */}
                <div className="neo-items-section">
                    <div className="neo-section-header">
                        <h2 className="neo-section-title">محصولات سفارش</h2>
                        <NeoBrutalistButton
                            text="+ افزودن محصول"
                            color="green-400"
                            textColor="black"
                            onClick={addOrderItem}
                            type="button"
                            className="neo-add-item-btn"
                        />
                    </div>

                    <div className="neo-items-list">
                        {orderItems.map((item, index) => (
                            <NeoBrutalistCard key={index} className="neo-item-card">
                                <div className="neo-item-header">
                                    <h3 className="neo-item-number">محصول #{index + 1}</h3>
                                    {orderItems.length > 1 && (
                                        <NeoBrutalistButton
                                            text="حذف"
                                            color="red-400"
                                            textColor="white"
                                            onClick={() => removeOrderItem(index)}
                                            type="button"
                                            className="neo-remove-btn"
                                        />
                                    )}
                                </div>

                                <div className="neo-item-fields">
                                    <div className="neo-field-group">
                                        <NeoBrutalistDropdown
                                            label="محصول"
                                            options={productOptions}
                                            value={item.product}
                                            onChange={(value) => updateOrderItem(index, 'product', value)}
                                            placeholder="محصول مورد نظر را انتخاب کنید..."
                                            required
                                        />
                                    </div>

                                    <div className="neo-field-group">
                                        <NeoBrutalistInput
                                            label="تعداد"
                                            type="number"
                                            value={item.requested_quantity}
                                            onChange={(e) => updateOrderItem(index, 'requested_quantity', e.target.value)}
                                            min="1"
                                            required
                                        />
                                    </div>

                                    <div className="neo-field-group">
                                        <NeoBrutalistInput
                                            label="وزن درخواستی (اختیاری)"
                                            type="text"
                                            value={item.customer_notes}
                                            onChange={(e) => updateOrderItem(index, 'customer_notes', e.target.value)}
                                            placeholder="مثال: 500 گرم"
                                        />
                                    </div>
                                </div>
                            </NeoBrutalistCard>
                        ))}
                    </div>
                </div>

                {/* Customer Comments */}
                <NeoBrutalistCard className="neo-comment-section">
                    <h3>توضیحات سفارش (اختیاری)</h3>
                    <textarea
                        className="neo-textarea"
                        value={customerComment}
                        onChange={(e) => setCustomerComment(e.target.value)}
                        placeholder="الزامات یا یادداشت‌های ویژه برای این سفارش..."
                        rows={4}
                    />
                </NeoBrutalistCard>

                {/* Submit Button */}
                <div className="neo-form-actions">
                    <NeoBrutalistButton
                        text={loading ? "در حال ثبت..." : "ثبت سفارش"}
                        color="yellow-400"
                        textColor="black"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="neo-submit-btn"
                    />
                </div>
            </div>
        </div>
    );
};

export default CreateOrderPage;