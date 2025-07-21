import React, { useState, useEffect } from 'react';
import API from './api';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistDropdown from './NeoBrutalist/NeoBrutalistDropdown';
import '../styles/CreateOrder.css';

const CreateOrderPage = ({ onOrderCreated }) => {
    const [products, setProducts] = useState([]);
    const [customerComment, setCustomerComment] = useState('');
    const [orderItems, setOrderItems] = useState([{ product: '', requested_quantity: 1, customer_notes: '' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await API.get('/products/');
            setProducts(response.data);
        } catch (err) {
            setError('Failed to load products');
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

    const getUserInfo = () => {
        const userDataString = localStorage.getItem('userData');
        return userDataString ? JSON.parse(userDataString) : null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Validate items
            const validItems = orderItems.filter(item =>
                item.product && item.requested_quantity > 0
            );

            if (validItems.length === 0) {
                throw new Error('Please add at least one item to your order');
            }

            const orderData = {
                customer_comment: customerComment,
                items: validItems.map(item => ({
                    product: parseInt(item.product),
                    requested_quantity: parseInt(item.requested_quantity),
                    customer_notes: item.customer_notes || ''
                }))
            };

            const response = await API.post('/orders/', orderData);

            if (response.status === 201) {
                if (onOrderCreated) {
                    onOrderCreated();
                }
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to create order');
        } finally {
            setLoading(false);
        }
    };

    const productOptions = products.map(product => ({
        value: product.id.toString(),
        label: `${product.name} - $${product.base_price}`
    }));

    const userInfo = getUserInfo();

    return (
        <div className="neo-create-order">
            <div className="neo-create-order-header">
                <h1 className="neo-create-order-title">ثبت سفارش جدید</h1>
                {userInfo && (
                    <div className="neo-customer-info">
                        <span className="neo-customer-label">مشتری</span>
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

            <form className="neo-order-form" onSubmit={handleSubmit}>
                <NeoBrutalistCard className="neo-comment-section">
                    <h3> جزئیات سفارش</h3>
                    <NeoBrutalistInput
                        className="neo-comment-input"
                        type="text"
                        placeholder="...الزامات یا یادداشت‌های ویژه برای این سفارت"
                        value={customerComment}
                        onChange={(e) => setCustomerComment(e.target.value)}
                    />
                </NeoBrutalistCard>

                <div className="neo-items-section">
                    <div className="neo-section-header">
                        <h2 className="neo-section-title">Order Items</h2>
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
                                    <h3 className="neo-item-number">Item #{index + 1}</h3>
                                    {orderItems.length > 1 && (
                                        <NeoBrutalistButton
                                            text="خذف"
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
                                            placeholder="...محول مورد نظر را انتخاب کنید"
                                            required
                                        />
                                    </div>

                                    <div className="neo-field-group">
                                        <NeoBrutalistInput
                                            className="neo-comment-input"
                                            type="number"
                                            placeholder="تعداد"
                                            value={item.requested_quantity}
                                            onChange={(e) => updateOrderItem(index, 'requested_quantity', e.target.value)}
                                            min="1"
                                            required
                                        />
                                    </div>

                                    <div className="neo-field-group">
                                        <NeoBrutalistInput
                                            className="neo-comment-input"
                                            type="text"
                                            placeholder="وزن درخواستی"
                                            value={item.customer_notes}
                                            onChange={(e) => updateOrderItem(index, 'customer_notes', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </NeoBrutalistCard>
                        ))}
                    </div>
                </div>

                <div className="neo-form-actions">
                    <NeoBrutalistButton
                        text={loading ? "... در حال ایحاد" : "ثبت سفارش"}
                        color="yellow-400"
                        textColor="black"
                        type="submit"
                        disabled={loading}
                        className="neo-submit-btn"
                    />
                </div>
            </form>
        </div>
    );
};

export default CreateOrderPage;