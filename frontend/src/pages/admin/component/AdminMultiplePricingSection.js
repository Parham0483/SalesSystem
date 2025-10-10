import React, { useState, useEffect } from 'react';
import API from '../../../component/api';
import NeoBrutalistCard from '../../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from '../../../component/NeoBrutalist/NeoBrutalistInput';
import { PersianNumberFormatter } from '../../../utils/persianNumberFormatter';

const PAYMENT_TERM_OPTIONS = [
    { value: 'instant', label: 'نقدی' },
    { value: '1_month', label: '1 ماهه' },
    { value: '2_month', label: '2 ماهه' },
    { value: '3_month', label: '3 ماهه' },
    { value: 'custom', label: 'سفارشی' }
];

const AdminMultiplePricingSection = ({ order, onUpdate, onOrderListRefresh }) => {
    const [items, setItems] = useState([]);
    const [adminComment, setAdminComment] = useState(order.admin_comment || '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        console.log('AdminMultiplePricing - Order received:', order);

        // Initialize items with pricing option columns
        const initialItems = (order.items || []).map(item => {
            console.log('Processing item:', item.product_name, 'ID:', item.id);

            const itemState = {
                ...item,
                final_quantity: item.requested_quantity || 0,
                admin_notes: '',
                // Enable cash and 1-month by default (minimum 2 options required)
                instant: { enabled: true, price: '', discount: 0 },
                '1_month': { enabled: true, price: '', discount: 0 },
                '2_month': { enabled: false, price: '', discount: 0 },
                '3_month': { enabled: false, price: '', discount: 0 },
                custom: { enabled: false, price: '', discount: 0, label: '' }
            };

            console.log('Item state after initialization:', itemState);
            return itemState;
        });

        console.log('Final items array:', initialItems);
        setItems(initialItems);
    }, [order]);

    const updateItemField = (itemIndex, field, value) => {
        const newItems = [...items];
        const newItem = { ...newItems[itemIndex] };
        newItem[field] = value;
        newItems[itemIndex] = newItem;
        setItems(newItems);
    };

    const updatePricingColumn = (itemIndex, term, field, value) => {
        const newItems = [...items];
        const newItem = { ...newItems[itemIndex] };
        const newTerm = { ...newItem[term] };
        newTerm[field] = value;
        newItem[term] = newTerm;
        newItems[itemIndex] = newItem;
        setItems(newItems);
    };

    const removeItem = async (itemId) => {
        if (!window.confirm('آیا مطمئن هستید که می‌خواهید این محصول را حذف کنید?')) {
            return;
        }

        try {
            await API.delete(`/orders/${order.id}/remove-item/${itemId}/`);
            alert('محصول با موفقیت حذف شد');
            if (onUpdate) {
                onUpdate();
            }
        } catch (err) {
            console.error('Error removing item:', err);
            alert(err.response?.data?.error || 'خطا در حذف محصول');
        }
    };

    const validateForm = () => {
        for (const item of items) {
            // Check final quantity
            if (!item.final_quantity || parseInt(item.final_quantity) <= 0) {
                setError(`لطفاً تعداد نهایی برای ${item.product_name} را وارد کنید`);
                return false;
            }

            // Count enabled pricing options
            const enabledOptions = PAYMENT_TERM_OPTIONS.filter(opt => item[opt.value].enabled);

            if (enabledOptions.length < 2) {
                setError(`حداقل 2 گزینه قیمت برای ${item.product_name} الزامی است`);
                return false;
            }

            if (enabledOptions.length > 10) {
                setError(`حداکثر 10 گزینه قیمت برای ${item.product_name} مجاز است`);
                return false;
            }

            // Validate each enabled option
            for (const opt of enabledOptions) {
                const option = item[opt.value];
                if (!option.price || parseFloat(option.price) <= 0) {
                    setError(`لطفاً قیمت برای ${opt.label} محصول ${item.product_name} را وارد کنید`);
                    return false;
                }

                if (opt.value === 'custom' && !option.label) {
                    setError(`لطفاً برچسب سفارشی برای محصول ${item.product_name} را وارد کنید`);
                    return false;
                }
            }
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        if (!validateForm()) {
            setSubmitting(false);
            return;
        }

        try {
            const payload = {
                items: items.map(item => {
                    const enabledOptions = [];

                    PAYMENT_TERM_OPTIONS.forEach(opt => {
                        if (item[opt.value].enabled) {
                            enabledOptions.push({
                                payment_term: opt.value,
                                custom_term_label: opt.value === 'custom' ? item[opt.value].label : undefined,
                                unit_price: parseFloat(item[opt.value].price),
                                discount_percentage: parseFloat(item[opt.value].discount) || 0,
                                admin_notes: ''
                            });
                        }
                    });

                    return {
                        item_id: item.id,
                        final_quantity: parseInt(item.final_quantity),
                        pricing_options: enabledOptions,
                        admin_notes: item.admin_notes || ''
                    };
                }),
                admin_comment: adminComment
            };

            console.log('Submitting payload:', JSON.stringify(payload, null, 2));

            const response = await API.post(`/orders/${order.id}/submit-multiple-pricing/`, payload);

            if (response.status === 200) {
                alert('قیمت‌گذاری چندگانه با موفقیت ثبت شد!');
                if (onUpdate) {
                    await onUpdate();
                }
                if (onOrderListRefresh) {
                    await onOrderListRefresh();
                }
            }
        } catch (err) {
            console.error('Error submitting multiple pricing:', err);
            const errorMessage = err.response?.data?.error || err.response?.data?.details || 'خطا در ثبت قیمت‌گذاری';
            setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
        } finally {
            setSubmitting(false);
        }
    };

    const calculateTotal = (price, quantity, discount) => {
        if (!price || !quantity) return 0;
        const subtotal = parseFloat(price) * parseInt(quantity);
        const discountAmount = (subtotal * (parseFloat(discount) || 0)) / 100;
        return subtotal - discountAmount;
    };

    return (
        <NeoBrutalistCard className="admin-multiple-pricing-card" style={{ borderLeft: '6px solid #f59e0b' }}>
            <div className="admin-card-header">
                <h2 className="admin-card-title">قیمت‌گذاری چندگانه</h2>
                <div style={{ fontSize: '0.9rem', color: '#666', fontFamily: 'Tahoma, sans-serif' }}>
                    حداقل 2 و حداکثر 5 گزینه قیمت برای هر محصول
                </div>
            </div>

            {error && (
                <div className="admin-error-message">
                    <span>⚠️ {error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="admin-pricing-form">
                {/* Admin Comment */}
                <div className="admin-comment-section">
                    <h3 className="admin-comment-title">نظر مدیر</h3>
                    <textarea
                        className="admin-comment-textarea"
                        value={adminComment}
                        onChange={e => setAdminComment(e.target.value)}
                        placeholder="نظرات و توضیحات مدیر برای این سفارش..."
                        rows={3}
                    />
                </div>

                {/* Pricing Table */}
                <div className="multi-pricing-table-container">
                    <table className="multi-pricing-table">
                        <thead>
                        <tr>
                            <th rowSpan="2">محصول</th>
                            <th rowSpan="2">تعداد درخواستی</th>
                            <th rowSpan="2">تعداد نهایی</th>
                            <th colSpan="5" className="pricing-options-header">گزینه‌های قیمت‌گذاری (با رادیو باتن انتخاب کنید)</th>
                            <th rowSpan="2">توضیحات</th>
                            <th rowSpan="2">عملیات</th>
                        </tr>
                        <tr>
                            {PAYMENT_TERM_OPTIONS.map(opt => (
                                <th key={opt.value} className="payment-term-header">
                                    {opt.label}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {items.map((item, idx) => (
                            <tr key={item.id}>
                                <td className="product-name-cell">{item.product_name}</td>
                                <td className="quantity-cell">
                                    {PersianNumberFormatter.formatQuantity(item.requested_quantity)}
                                </td>
                                <td className="final-quantity-cell">
                                    <input
                                        type="number"
                                        className="quantity-input-field"
                                        value={item.final_quantity}
                                        onChange={e => updateItemField(idx, 'final_quantity', e.target.value)}
                                        min="1"
                                        required
                                    />
                                </td>

                                {/* Pricing Option Columns */}
                                {PAYMENT_TERM_OPTIONS.map(opt => (
                                    <td key={opt.value} className="pricing-option-cell">
                                        <div className="pricing-option-content">
                                            {/* Radio button to enable this option */}
                                            <label className="pricing-radio-label">
                                                <input
                                                    type="checkbox"
                                                    checked={item[opt.value].enabled}
                                                    onChange={e => updatePricingColumn(idx, opt.value, 'enabled', e.target.checked)}
                                                />
                                                <span>فعال</span>
                                            </label>

                                            {item[opt.value].enabled && (
                                                <>
                                                    {opt.value === 'custom' && (
                                                        <input
                                                            type="text"
                                                            className="custom-label-input"
                                                            value={item[opt.value].label}
                                                            onChange={e => updatePricingColumn(idx, opt.value, 'label', e.target.value)}
                                                            placeholder="برچسب"
                                                            required
                                                        />
                                                    )}
                                                    <input
                                                        type="number"
                                                        className="price-input"
                                                        value={item[opt.value].price}
                                                        onChange={e => updatePricingColumn(idx, opt.value, 'price', e.target.value)}
                                                        placeholder="قیمت"
                                                        min="0"
                                                        step="100"
                                                        required
                                                    />
                                                    <input
                                                        type="number"
                                                        className="discount-input"
                                                        value={item[opt.value].discount}
                                                        onChange={e => updatePricingColumn(idx, opt.value, 'discount', e.target.value)}
                                                        placeholder="تخفیف %"
                                                        min="0"
                                                        max="100"
                                                        step="0.1"
                                                    />
                                                    <div className="option-total">
                                                        {PersianNumberFormatter.formatPrice(
                                                            calculateTotal(item[opt.value].price, item.final_quantity, item[opt.value].discount)
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                ))}

                                <td className="notes-cell">
                                        <textarea
                                            className="item-notes-input"
                                            value={item.admin_notes}
                                            onChange={e => updateItemField(idx, 'admin_notes', e.target.value)}
                                            placeholder="توضیحات..."
                                            rows={2}
                                        />
                                </td>
                                <td className="action-cell">
                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.id)}
                                        className="remove-item-btn"
                                    >
                                        🗑️
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>



                {/* Submit Button */}
                <div className="admin-submit-section">
                    <NeoBrutalistButton
                        text={submitting ? "" : "ثبت قیمت‌گذاری و ارسال به مشتری"}
                        color="yellow-400"
                        textColor="black"
                        type="submit"
                        disabled={submitting}
                        className="admin-submit-btn"
                    />
                </div>

                {/* Info Box */}
                <div className="pricing-info-box">
                    <strong>💡 راهنما:</strong>
                    <ul>
                        <li>با تیک زدن "فعال" گزینه‌های مورد نظر را انتخاب کنید (حداقل 2)</li>
                        <li>برای هر گزینه فعال، قیمت را وارد کنید</li>
                        <li>تخفیف به صورت درصدی اعمال می‌شود</li>
                        <li>مشتری یک گزینه از گزینه‌های فعال را انتخاب خواهد کرد</li>
                    </ul>
                </div>
            </form>
        </NeoBrutalistCard>
    );
};

export default AdminMultiplePricingSection;