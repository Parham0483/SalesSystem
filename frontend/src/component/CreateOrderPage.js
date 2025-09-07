import React, { useState, useEffect } from 'react';
import API from './api';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistDropdown from './NeoBrutalist/NeoBrutalistDropdown';
import '../styles/component/CustomerComponent/CreateOrder.css';

const CreateOrderPage = ({ onOrderCreated }) => {
    // Product and Category states
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [loadingProducts, setLoadingProducts] = useState(false);

    // Other existing states
    const [customerComment, setCustomerComment] = useState('');
    const [orderItems, setOrderItems] = useState([{ category: '', product: '', requested_quantity: 1, customer_notes: '' }]);
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
        fetchCategories();
        fetchProducts();
        loadCustomerInfo();
    }, []);

    // Filter products when category changes
    useEffect(() => {
        if (selectedCategory && products.length > 0) {
            const filtered = products.filter(product =>
                product.category_id?.toString() === selectedCategory ||
                product.category?.toString() === selectedCategory
            );
            setFilteredProducts(filtered);
        } else {
            setFilteredProducts([]);
        }
    }, [selectedCategory, products]);

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

    const fetchCategories = async () => {
        setLoadingCategories(true);
        try {
            console.log('Starting to fetch categories...');
            console.log('API object:', API);

            // Check if API.get is available
            if (!API || typeof API.get !== 'function') {
                throw new Error('API object or API.get method is not available');
            }

            console.log('Making API call to /categories/...');
            const response = await API.get('/categories/');
            console.log('Raw categories response:', response);
            console.log('Response status:', response?.status);
            console.log('Response data:', response?.data);
            console.log('Data type:', typeof response?.data);
            console.log('Is data an array?', Array.isArray(response?.data));

            if (response && response.data) {
                if (Array.isArray(response.data)) {
                    setCategories(response.data);
                    console.log('✅ Categories successfully loaded:', response.data.length, 'categories');
                    // Log category structure to verify farsi_name field
                    if (response.data.length > 0) {
                        console.log('Sample category structure:', response.data[0]);
                        console.log('Available fields:', Object.keys(response.data[0]));
                    }
                } else if (response.data.results && Array.isArray(response.data.results)) {
                    // Handle paginated response
                    setCategories(response.data.results);
                    console.log('✅ Categories loaded from paginated response:', response.data.results.length, 'categories');
                } else {
                    console.error('❌ Categories response is not an array:', response.data);
                    setCategories([]);
                    setError('خطا در بارگیری دسته‌بندی‌ها - فرمت داده نادرست');
                }
            } else {
                console.error('❌ No response or response.data:', response);
                setCategories([]);
                setError('خطا در دریافت پاسخ از سرور');
            }
        } catch (err) {
            console.error('❌ Error fetching categories:', err);
            console.error('Error type:', err.constructor.name);
            console.error('Error message:', err.message);
            console.error('Error stack:', err.stack);

            if (err.response) {
                console.error('Error response status:', err.response.status);
                console.error('Error response data:', err.response.data);
                console.error('Error response headers:', err.response.headers);
            } else if (err.request) {
                console.error('No response received. Request:', err.request);
            }

            setCategories([]);

            // More descriptive error messages
            let errorMessage = 'خطا در بارگیری دسته‌بندی‌ها';
            if (err.response?.status === 404) {
                errorMessage += ': آدرس API پیدا نشد (404)';
            } else if (err.response?.status === 403) {
                errorMessage += ': دسترسی غیرمجاز (403)';
            } else if (err.response?.status === 401) {
                errorMessage += ': نیاز به احراز هویت (401)';
            } else if (err.response?.status >= 500) {
                errorMessage += ': خطای سرور (' + err.response.status + ')';
            } else if (!err.response) {
                errorMessage += ': عدم اتصال به سرور';
            } else {
                errorMessage += ': ' + (err.response?.data?.message || err.message);
            }

            setError(errorMessage);
        } finally {
            setLoadingCategories(false);
            console.log('Categories fetch completed');
        }
    };

    const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
            console.log('Starting to fetch products...');
            // Use the new endpoint that returns all products
            const response = await API.get('/products/all-for-orders/');
            console.log('Raw products response:', response);

            if (response && response.data) {
                // This should be a direct array, not paginated
                if (Array.isArray(response.data)) {
                    setProducts(response.data);
                } else {
                    setProducts([]);
                    setError('خطا در بارگیری محصولات - فرمت داده نادرست');
                }
            } else {
                setProducts([]);
                setError('خطا در دریافت پاسخ از سرور');
            }
        } catch (err) {
            setProducts([]);
            setError('خطا در بارگیری محصولات: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoadingProducts(false);
        }
    };

    const loadCustomerInfo = async () => {
        setLoadingCustomerInfo(true);
        try {
            const response = await API.get('/customers/invoice-info/');
            if (response.status === 200) {
                setCustomerInfo(response.data.customer_info);
                setCustomerInfoLoaded(true);
            }
        } catch (err) {
            console.error('Error loading customer info:', err);
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
                return true;
            }
        } catch (err) {
            console.error('Error updating customer info:', err);
            if (err.response?.data?.details) {
                setCustomerInfoErrors(err.response.data.details);
            } else {
                setError('خطا در به‌روزرسانی اطلاعات مشتری');
            }
            return false;
        }
    };

    const addOrderItem = () => {
        setOrderItems([...orderItems, { category: '', product: '', requested_quantity: 1, customer_notes: '' }]);
    };

    const removeOrderItem = (index) => {
        if (orderItems.length > 1) {
            setOrderItems(orderItems.filter((_, i) => i !== index));
        }
    };

    const updateOrderItem = (index, field, value) => {
        const updatedItems = orderItems.map((item, i) => {
            if (i === index) {
                // If category changes, reset product selection
                if (field === 'category') {
                    return { ...item, [field]: value, product: '' };
                }
                return { ...item, [field]: value };
            }
            return item;
        });
        setOrderItems(updatedItems);
    };

    // Get filtered products for a specific order item
    const getFilteredProductsForItem = (categoryId) => {
        if (!categoryId || !products.length) return [];

        return products.filter(product =>
            product.category_id?.toString() === categoryId ||
            product.category?.toString() === categoryId
        );
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            // Validate items
            const validItems = orderItems.filter(item =>
                item.category && item.product && item.requested_quantity > 0
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

            const response = await API.post('orders/', orderData);

            if (response.status === 201) {
                alert(`سفارش با موفقیت ثبت شد!\nشماره سفارش: ${response.data.id}`);

                if (onOrderCreated) {
                    onOrderCreated();
                }
            }
        } catch (err) {
            console.error('Order creation failed:', err);
            setError(err.response?.data?.error || err.message || 'خطا در ثبت سفارش');
        } finally {
            setLoading(false);
        }
    };

    // Create category options - use name_fa for Persian names
    const categoryOptions = Array.isArray(categories) ? categories.map(category => ({
        value: category.id.toString(),
        label: category.name_fa || category.display_name || category.name || `دسته‌بندی ${category.id}`
    })) : [];

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

            {/* Debug Information */}
            {(loadingCategories || loadingProducts) && (
                <NeoBrutalistCard className="neo-loading-card">
                    <div className="neo-loading-content">
                        <span>🔄</span>
                        <span>
                            {loadingCategories && 'در حال بارگیری دسته‌بندی‌ها... '}
                            {loadingProducts && 'در حال بارگیری محصولات... '}
                        </span>
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


                {needsOfficialInvoice && (
                    <NeoBrutalistCard className="neo-customer-form-section">
                        <div className="neo-customer-form-header">
                            <h3>اطلاعات مورد نیاز برای فاکتور رسمی</h3>
                            {loadingCustomerInfo && (
                                <span className="neo-loading-text">📄 در حال بارگیری اطلاعات...</span>
                            )}
                        </div>

                        <div className="neo-customer-form">
                            <div className="neo-form-row">
                                <div className="neo-form-field neo-tooltip-container">
                                    <NeoBrutalistInput
                                        label="نام کامل *"
                                        value={customerInfo.name}
                                        onChange={(e) => handleCustomerInfoChange('name', e.target.value)}
                                        error={customerInfoErrors.name}
                                        placeholder="نام و نام خانوادگی"
                                        className={`${customerInfoErrors.name ? 'neo-required-field' : ''}`}
                                    />
                                    <div className="neo-field-tooltip" data-field="name">
                                        <div className="neo-tooltip-content">
                                            <div className="neo-tooltip-text">
                                                <strong>نام کامل شما</strong>
                                                <p>این نام در فاکتور رسمی ثبت خواهد شد</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="neo-form-field neo-tooltip-container">
                                    <NeoBrutalistInput
                                        label="شماره تماس *"
                                        value={customerInfo.phone}
                                        onChange={(e) => handleCustomerInfoChange('phone', e.target.value)}
                                        error={customerInfoErrors.phone}
                                        placeholder="09123456789"
                                        className={`${customerInfoErrors.phone ? 'neo-required-field' : ''}`}
                                    />
                                    <div className="neo-field-tooltip" data-field="phone">
                                        <div className="neo-tooltip-content">
                                            <div className="neo-tooltip-text">
                                                <strong>شماره تماس معتبر</strong>
                                                <p>مثال: 09123456789</p>
                                                <p>برای ارسال اطلاعیه‌های سفارش</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="neo-form-row">
                                <div className="neo-form-field neo-tooltip-container">
                                    <NeoBrutalistInput
                                        label="نام شرکت (اختیاری)"
                                        value={customerInfo.company_name}
                                        onChange={(e) => handleCustomerInfoChange('company_name', e.target.value)}
                                        placeholder="نام شرکت"
                                    />
                                    <div className="neo-field-tooltip" data-field="company">
                                        <div className="neo-tooltip-content">
                                            <div className="neo-tooltip-text">
                                                <strong>نام شرکت (اختیاری)</strong>
                                                <p>فاکتور به نام شرکت صادر می‌شود</p>
                                                <p>برای اشخاص حقوقی</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="neo-form-field neo-tooltip-container">
                                    <NeoBrutalistInput
                                        label="شناسه ملی *"
                                        value={customerInfo.national_id}
                                        onChange={(e) => handleCustomerInfoChange('national_id', e.target.value)}
                                        error={customerInfoErrors.national_id}
                                        placeholder="کد ملی یا شناسه ملی"
                                        maxLength="10"
                                        className={`${customerInfoErrors.national_id ? 'neo-required-field' : ''}`}
                                    />
                                    <div className="neo-field-tooltip" data-field="national_id">
                                        <div className="neo-tooltip-content">
                                            <div className="neo-tooltip-text">
                                                <strong>کد ملی</strong>
                                                <p>کد ملی 10 رقمی یا شناسه ملی</p>
                                                <p>برای ثبت در سامانه مالیاتی</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="neo-form-row">
                                <div className="neo-form-field neo-tooltip-container">
                                    <NeoBrutalistInput
                                        label="شناسه اقتصادی"
                                        value={customerInfo.economic_id}
                                        onChange={(e) => handleCustomerInfoChange('economic_id', e.target.value)}
                                        placeholder="شناسه اقتصادی"
                                    />
                                    <div className="neo-field-tooltip" data-field="economic_id">
                                        <div className="neo-tooltip-content">
                                            <div className="neo-tooltip-text">
                                                <strong>شناسه اقتصادی</strong>
                                                <p>فقط برای شرکت‌های دارای شناسه</p>
                                                <p>اختیاری برای اشخاص حقیقی</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="neo-form-field neo-tooltip-container">
                                    <NeoBrutalistInput
                                        label="کد پستی *"
                                        value={customerInfo.postal_code}
                                        onChange={(e) => handleCustomerInfoChange('postal_code', e.target.value)}
                                        error={customerInfoErrors.postal_code}
                                        placeholder="1234567890"
                                        maxLength="10"
                                        className={`${customerInfoErrors.postal_code ? 'neo-required-field' : ''}`}
                                    />
                                    <div className="neo-field-tooltip" data-field="postal_code">
                                        <div className="neo-tooltip-content">
                                            <div className="neo-tooltip-text">
                                                <strong>کد پستی</strong>
                                                <p>کد پستی 10 رقمی</p>
                                                <p>برای تکمیل آدرس فاکتور</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="neo-form-row">
                                <div className="neo-form-field neo-tooltip-container">
                                    <NeoBrutalistInput
                                        label="استان *"
                                        value={customerInfo.province}
                                        onChange={(e) => handleCustomerInfoChange('province', e.target.value)}
                                        error={customerInfoErrors.province}
                                        placeholder="تهران"
                                        className={`${customerInfoErrors.province ? 'neo-required-field' : ''}`}
                                    />
                                    <div className="neo-field-tooltip" data-field="province">
                                        <div className="neo-tooltip-content">
                                            <div className="neo-tooltip-text">
                                                <strong>استان محل سکونت</strong>
                                                <p>نام استان به فارسی</p>
                                                <p>مثال: تهران، اصفهان</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="neo-form-field neo-tooltip-container">
                                    <NeoBrutalistInput
                                        label="شهر *"
                                        value={customerInfo.city}
                                        onChange={(e) => handleCustomerInfoChange('city', e.target.value)}
                                        error={customerInfoErrors.city}
                                        placeholder="تهران"
                                        className={`${customerInfoErrors.city ? 'neo-required-field' : ''}`}
                                    />
                                    <div className="neo-field-tooltip" data-field="city">
                                        <div className="neo-tooltip-content">
                                            <div className="neo-tooltip-text">
                                                <strong>شهر محل سکونت</strong>
                                                <p>نام شهر به فارسی</p>
                                                <p>مثال: تهران، کرج</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="neo-form-row">
                                <div className="neo-textarea-group neo-tooltip-container">
                                    <label className="neo-textarea-label">آدرس کامل *</label>
                                    <textarea
                                        className={`neo-textarea ${customerInfoErrors.complete_address ? 'error neo-required-field' : ''}`}
                                        value={customerInfo.complete_address}
                                        onChange={(e) => handleCustomerInfoChange('complete_address', e.target.value)}
                                        placeholder="تهران، خیابان آزادی، پلاک 123، طبقه 2"
                                        rows={3}
                                    />
                                    <div className="neo-field-tooltip" data-field="address">
                                        <div className="neo-tooltip-content">
                                            <div className="neo-tooltip-text">
                                                <strong>آدرس کامل</strong>
                                                <p>آدرس دقیق شامل خیابان، کوچه، پلاک</p>
                                                <p>این آدرس در فاکتور رسمی درج می‌شود</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Overall Status Summary */}
                        {Object.keys(customerInfoErrors).length > 0 ? (
                            <div className="neo-form-status error">
                                <span className="neo-status-icon">⚠️</span>
                                <span className="neo-status-text">
                    برای صدور فاکتور رسمی، {Object.keys(customerInfoErrors).length} فیلد باقی‌مانده
                </span>
                            </div>
                        ) : customerInfoLoaded && (
                            <div className="neo-form-status success">
                                <span className="neo-status-icon">✅</span>
                                <span className="neo-status-text">
                    آماده برای صدور فاکتور رسمی
                </span>
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
                        {orderItems.map((item, index) => {
                            const itemFilteredProducts = getFilteredProductsForItem(item.category);
                            const productOptions = itemFilteredProducts.map(product => ({
                                value: product.id.toString(),
                                label: `${product.name}`
                            }));

                            return (
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
                                        {/* Category Selection */}
                                        <div className="neo-field-group">
                                            <NeoBrutalistDropdown
                                                label="دسته‌بندی"
                                                options={categoryOptions}
                                                value={item.category}
                                                onChange={(value) => updateOrderItem(index, 'category', value)}
                                                placeholder="ابتدا دسته‌بندی را انتخاب کنید..."
                                                required
                                                disabled={loadingCategories}
                                            />
                                            {loadingCategories && (
                                                <small style={{color: '#666', fontSize: '12px'}}>
                                                    در حال بارگیری دسته‌بندی‌ها...
                                                </small>
                                            )}
                                        </div>

                                        {/* Product Selection */}
                                        <div className="neo-field-group">
                                            <NeoBrutalistDropdown
                                                label="محصول"
                                                options={productOptions}
                                                value={item.product}
                                                onChange={(value) => updateOrderItem(index, 'product', value)}
                                                placeholder={
                                                    !item.category
                                                        ? "ابتدا دسته‌بندی را انتخاب کنید"
                                                        : itemFilteredProducts.length === 0
                                                            ? "محصولی در این دسته‌بندی یافت نشد"
                                                            : "محصول مورد نظر را انتخاب کنید..."
                                                }
                                                required
                                                disabled={!item.category || loadingProducts || itemFilteredProducts.length === 0}
                                            />
                                            {item.category && itemFilteredProducts.length === 0 && !loadingProducts && (
                                                <small style={{color: '#f59e0b', fontSize: '12px'}}>
                                                    هیچ محصولی در این دسته‌بندی یافت نشد
                                                </small>
                                            )}
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
                            );
                        })}
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
                        disabled={loading || loadingCategories || loadingProducts}
                        className="neo-submit-btn"
                    />
                </div>
            </div>
        </div>
    );
};

export default CreateOrderPage;