import React, { useState, useEffect } from 'react';
import API from '../../../component/api';
import NeoBrutalistCard from '../../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../../component/NeoBrutalist/NeoBrutalistButton';
import { PersianNumberFormatter } from '../../../utils/persianNumberFormatter';

const PAYMENT_TERM_OPTIONS = [
    { value: 'instant', label: 'نقدی' },
    { value: '1_month', label: '1 ماهه' },
    { value: '2_month', label: '2 ماهه' },
    { value: '3_month', label: '3 ماهه' },
    { value: 'custom', label: 'سفارشی' }
];

const AdminPricingEditSection = ({ order, onUpdate, onOrderListRefresh, onMajorStatusChange, readOnly = false }) => {
    const [items, setItems] = useState([]);
    const [adminComment, setAdminComment] = useState(order.admin_comment || '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [notifyCustomer, setNotifyCustomer] = useState(false);
    const [editing, setEditing] = useState(order.status === 'pending_pricing');

    useEffect(() => {
        console.log('Order data received:', JSON.stringify(order, null, 2));
        console.log('Items with tax rates:', order.items?.map(item => ({
            id: item.id,
            name: item.product_name,
            tax_rate: item.product?.tax_rate,
            has_product: !!item.product,
            is_active: item.is_active
        })));

        // Include ALL items (active and inactive) for admin view
        const initialItems = (order.items || []).map(item => {
            const options = item.pricing_options || [];
            console.log('Item pricing options for ID', item.id, ':', JSON.stringify(options, null, 2));
            const pricingMap = {
                instant: { enabled: false, price: '', discount: 0 },
                '1_month': { enabled: false, price: '', discount: 0 },
                '2_month': { enabled: false, price: '', discount: 0 },
                '3_month': { enabled: false, price: '', discount: 0 },
                custom: { enabled: false, price: '', discount: 0, label: '' }
            };

            options.forEach(opt => {
                if (opt && opt.payment_term) {
                    pricingMap[opt.payment_term] = {
                        enabled: true,
                        price: opt.unit_price || '',
                        discount: opt.discount_percentage || 0,
                        label: opt.custom_term_label || ''
                    };
                }
            });

            return {
                ...item,
                final_quantity: item.final_quantity || item.requested_quantity || 0,
                admin_notes: item.admin_notes || '',
                is_active: item.is_active !== false,
                ...pricingMap
            };
        });
        setItems(initialItems);
    }, [order]);

    const updateItemField = (itemIndex, field, value) => {
        if (readOnly || !editing) return;
        setItems(prevItems => {
            const newItems = [...prevItems];
            newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
            return newItems;
        });
    };

    const updatePricingColumn = (itemIndex, term, field, value) => {
        if (readOnly || !editing) return;
        setItems(prevItems => {
            const newItems = [...prevItems];
            newItems[itemIndex] = {
                ...newItems[itemIndex],
                [term]: {
                    ...newItems[itemIndex][term],
                    [field]: value
                }
            };
            return newItems;
        });
    };

    const removeItem = async (itemId) => {
        if (readOnly || !editing) return;
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
        // Only validate active items
        const activeItems = items.filter(item => item.is_active !== false);

        for (const item of activeItems) {
            if (!item.final_quantity || parseInt(item.final_quantity) <= 0) {
                setError(`لطفاً تعداد نهایی برای ${item.product_name} را وارد کنید`);
                return false;
            }

            const enabledOptions = PAYMENT_TERM_OPTIONS.filter(opt => item[opt.value].enabled);

            if (enabledOptions.length < 2) {
                setError(`حداقل 2 گزینه قیمت برای ${item.product_name} الزامی است`);
                return false;
            }

            if (enabledOptions.length > 10) {
                setError(`حداکثر 10 گزینه قیمت برای ${item.product_name} مجاز است`);
                return false;
            }

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
        if (readOnly || !editing) return;
        e.preventDefault();
        setSubmitting(true);
        setError('');

        if (!validateForm()) {
            setSubmitting(false);
            return;
        }

        try {
            // Only submit active items
            const activeItems = items.filter(item => item.is_active !== false);

            const payload = {
                items: activeItems.map(item => {
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
                admin_comment: adminComment,
                notify_customer: notifyCustomer
            };

            console.log('Submitting update payload:', JSON.stringify(payload, null, 2));

            const response = await API.post(`/orders/${order.id}/update-multiple-pricing/`, payload);

            if (response.status === 200) {
                alert('به‌روزرسانی قیمت‌گذاری چندگانه با موفقیت ثبت شد!');
                setEditing(false);
                if (onUpdate) {
                    await onUpdate();
                }
                if (onOrderListRefresh) {
                    await onOrderListRefresh();
                }
                if (notifyCustomer && onMajorStatusChange) {
                    await onMajorStatusChange();
                }
            }
        } catch (err) {
            console.error('Error updating multiple pricing:', err);
            const errorMessage = err.response?.data?.error || err.response?.data?.details || 'خطا در به‌روزرسانی قیمت‌گذاری';
            setError(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
        } finally {
            setSubmitting(false);
        }
    };

    const calculateTotal = (price, quantity, discount, includeTax = false, taxRate = 0) => {
        if (!price || !quantity) return 0;
        const subtotal = parseFloat(price) * parseInt(quantity);
        const discountAmount = (subtotal * (parseFloat(discount) || 0)) / 100;
        const totalBeforeTax = subtotal - discountAmount;

        if (includeTax && taxRate > 0) {
            const taxAmount = totalBeforeTax * (parseFloat(taxRate) / 100);
            return totalBeforeTax + taxAmount;
        }

        return totalBeforeTax;
    };

    const handleStartEditing = () => {
        if (readOnly) {
            alert('ویرایش برای این سفارش قفل شده است (وضعیت: تکمیل شده).');
            return;
        }
        setEditing(true);
        setError('');
    };

    const handleCancelEditing = () => {
        setEditing(false);
        setItems((order.items || []).map(item => {
            const pricingMap = {
                instant: { enabled: false, price: '', discount: 0 },
                '1_month': { enabled: false, price: '', discount: 0 },
                '2_month': { enabled: false, price: '', discount: 0 },
                '3_month': { enabled: false, price: '', discount: 0 },
                custom: { enabled: false, price: '', discount: 0, label: '' }
            };

            (item.pricing_options || []).forEach(opt => {
                pricingMap[opt.payment_term] = {
                    enabled: true,
                    price: opt.unit_price || '',
                    discount: opt.discount_percentage || 0,
                    label: opt.custom_term_label || ''
                };
            });

            return {
                ...item,
                final_quantity: item.final_quantity || item.requested_quantity || 0,
                admin_notes: item.admin_notes || '',
                is_active: item.is_active !== false,
                ...pricingMap
            };
        }));
        setAdminComment(order.admin_comment || '');
        setNotifyCustomer(false);
        setError('');
    };

    return (
        <NeoBrutalistCard className="admin-multiple-pricing-card" style={{ borderLeft: '6px solid #3b82f6' }}>
            <div className="admin-card-header">
                <h2 className="admin-card-title">{readOnly || !editing ? 'نمایش قیمت‌گذاری چندگانه' : 'ویرایش قیمت‌گذاری چندگانه'}</h2>
                <div style={{ fontSize: '0.9rem', color: '#666', fontFamily: 'Tahoma, sans-serif' }}>
                    حداقل 2 و حداکثر 5 گزینه قیمت برای هر محصول
                </div>
            </div>

            {error && (
                <div className="admin-error-message">
                    <span>⚠️ {error}</span>
                </div>
            )}

            {!readOnly && !editing && (
                <div className="admin-edit-section" style={{ margin: '1rem 0' }}>
                    <NeoBrutalistButton
                        text="ویرایش قیمت‌گذاری"
                        color="yellow-400"
                        textColor="black"
                        onClick={handleStartEditing}
                        disabled={submitting}
                        className="admin-edit-btn"
                    />
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
                        disabled={readOnly || !editing}
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
                            <th colSpan="5" className="pricing-options-header">گزینه‌های قیمت‌گذاری</th>
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
                        {items.map((item, idx) => {
                            // Find which option was selected by the customer
                            const selectedOptionId = item.pricing_options?.find(opt => opt.is_selected)?.id;
                            const selectedTerm = item.pricing_options?.find(opt => opt.is_selected)?.payment_term;

                            // Check if item is deleted/inactive
                            const isDeleted = item.is_active === false;

                            return (
                                <tr
                                    key={item.id}
                                    style={{
                                        backgroundColor: isDeleted ? '#fee2e2' : 'transparent',
                                        opacity: isDeleted ? 0.7 : 1,
                                        position: 'relative'
                                    }}
                                >
                                    <td className="product-name-cell">
                                        <div style={{ position: 'relative' }}>
                                            {item.product_name}
                                            {isDeleted && (
                                                <div style={{
                                                    display: 'inline-block',
                                                    color: 'white',
                                                    fontSize: '1rem',
                                                    fontWeight: 'bold',
                                                }}>
                                                    🗑️
                                                </div>
                                            )}
                                            {isDeleted && item.removed_at && (
                                                <div style={{
                                                    fontSize: '0.75rem',
                                                    color: '#991b1b',
                                                    marginTop: '0.25rem'
                                                }}>
                                                    حذف شده در: {new Date(item.removed_at).toLocaleDateString('fa-IR')}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="quantity-cell">
                                        <span style={{
                                            textDecoration: isDeleted ? 'line-through' : 'none',
                                            color: isDeleted ? '#991b1b' : 'inherit'
                                        }}>
                                            {PersianNumberFormatter.formatQuantity(item.requested_quantity)}
                                        </span>
                                    </td>
                                    <td className="final-quantity-cell">
                                        {editing && !readOnly && !isDeleted ? (
                                            <input
                                                type="number"
                                                className="quantity-input-field"
                                                value={item.final_quantity}
                                                onChange={e => updateItemField(idx, 'final_quantity', e.target.value)}
                                                min="1"
                                                required
                                                disabled={isDeleted}
                                            />
                                        ) : (
                                            <span style={{
                                                textDecoration: isDeleted ? 'line-through' : 'none',
                                                color: isDeleted ? '#991b1b' : 'inherit'
                                            }}>
                                                {PersianNumberFormatter.formatQuantity(item.final_quantity)}
                                            </span>
                                        )}
                                    </td>

                                    {/* Pricing Option Columns */}
                                    {PAYMENT_TERM_OPTIONS.map(opt => {
                                        const isCustomerSelected = selectedTerm === opt.value && !isDeleted;

                                        return (
                                            <td
                                                key={opt.value}
                                                className="pricing-option-cell"
                                                style={{
                                                    backgroundColor: isDeleted ? '#fecaca' : (isCustomerSelected ? '#dbeafe' : 'transparent'),
                                                    borderLeft: isCustomerSelected && !isDeleted ? '4px solid #3b82f6' : 'none',
                                                    position: 'relative',
                                                    opacity: isDeleted ? 0.6 : 1
                                                }}
                                            >
                                                {/* Customer Selection Badge - only show if not deleted */}
                                                {isCustomerSelected && !isDeleted && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        right: '4px',
                                                        backgroundColor: '#3b82f6',
                                                        color: 'white',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 'bold',
                                                        zIndex: 10,
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                                    }}>
                                                        ✓ انتخاب مشتری
                                                    </div>
                                                )}

                                                {editing && !readOnly && !isDeleted ? (
                                                    <div className="pricing-option-content">
                                                        <label className="pricing-radio-label">
                                                            <input
                                                                type="checkbox"
                                                                checked={item[opt.value].enabled}
                                                                onChange={e => updatePricingColumn(idx, opt.value, 'enabled', e.target.checked)}
                                                                disabled={readOnly || isDeleted}
                                                            />
                                                            <span style={{ fontWeight: isCustomerSelected ? 'bold' : 'normal' }}>
                                                                فعال
                                                            </span>
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
                                                                        disabled={readOnly || isDeleted}
                                                                        style={{
                                                                            borderColor: isCustomerSelected ? '#3b82f6' : '#ccc'
                                                                        }}
                                                                    />
                                                                )}
                                                                <input
                                                                    type="number"
                                                                    className="price-input"
                                                                    value={item[opt.value].price}
                                                                    onChange={e => updatePricingColumn(idx, opt.value, 'price', e.target.value)}
                                                                    placeholder="قیمت"
                                                                    min="0"
                                                                    step="0.01"
                                                                    required
                                                                    disabled={readOnly || isDeleted}
                                                                    style={{
                                                                        borderColor: isCustomerSelected ? '#3b82f6' : '#ccc',
                                                                        fontWeight: isCustomerSelected ? 'bold' : 'normal'
                                                                    }}
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
                                                                    disabled={readOnly || isDeleted}
                                                                    style={{
                                                                        borderColor: isCustomerSelected ? '#3b82f6' : '#ccc'
                                                                    }}
                                                                />
                                                                <div className="option-total">
                                                                    <div
                                                                        className="total-label"
                                                                        style={{
                                                                            fontWeight: isCustomerSelected ? 'bold' : 'normal',
                                                                            color: isCustomerSelected ? '#1e40af' : 'inherit'
                                                                        }}
                                                                    >
                                                                        {order.business_invoice_type === 'official' ? 'با مالیات:' : 'جمع:'}
                                                                    </div>
                                                                    <div
                                                                        className="total-value"
                                                                        style={{
                                                                            fontWeight: isCustomerSelected ? 'bold' : 'normal',
                                                                            color: isCustomerSelected ? '#1e40af' : 'inherit'
                                                                        }}
                                                                    >
                                                                        {PersianNumberFormatter.formatPrice(
                                                                            calculateTotal(
                                                                                item[opt.value].price,
                                                                                item.final_quantity,
                                                                                item[opt.value].discount,
                                                                                order.business_invoice_type === 'official',
                                                                                item.product?.tax_rate || 10
                                                                            )
                                                                        )}
                                                                    </div>
                                                                    {order.business_invoice_type === 'official' && (
                                                                        <div className="tax-info" style={{
                                                                            fontSize: '0.75rem',
                                                                            color: isCustomerSelected ? '#1e40af' : '#6b7280',
                                                                            marginTop: '0.25rem',
                                                                            fontWeight: isCustomerSelected ? 'bold' : 'normal'
                                                                        }}>
                                                                            (شامل {item.product?.tax_rate || 10}% مالیات)
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="pricing-option-content">
                                                        {item[opt.value].enabled ? (
                                                            <>
                                                                {opt.value === 'custom' && item[opt.value].label && (
                                                                    <div
                                                                        className="custom-label"
                                                                        style={{
                                                                            fontWeight: isCustomerSelected && !isDeleted ? 'bold' : 'normal',
                                                                            color: isDeleted ? '#991b1b' : (isCustomerSelected ? '#1e40af' : 'inherit'),
                                                                            textDecoration: isDeleted ? 'line-through' : 'none'
                                                                        }}
                                                                    >
                                                                        {item[opt.value].label}
                                                                    </div>
                                                                )}
                                                                <div
                                                                    className="price-display"
                                                                    style={{
                                                                        fontWeight: isCustomerSelected && !isDeleted ? 'bold' : 'normal',
                                                                        color: isDeleted ? '#991b1b' : (isCustomerSelected ? '#1e40af' : 'inherit'),
                                                                        textDecoration: isDeleted ? 'line-through' : 'none'
                                                                    }}
                                                                >
                                                                    {PersianNumberFormatter.formatPrice(item[opt.value].price)}
                                                                </div>
                                                                {item[opt.value].discount > 0 && (
                                                                    <div
                                                                        className="discount-display"
                                                                        style={{
                                                                            fontWeight: isCustomerSelected && !isDeleted ? 'bold' : 'normal',
                                                                            textDecoration: isDeleted ? 'line-through' : 'none',
                                                                            color: isDeleted ? '#991b1b' : 'inherit'
                                                                        }}
                                                                    >
                                                                        تخفیف: {item[opt.value].discount}%
                                                                    </div>
                                                                )}
                                                                <div className="option-total">
                                                                    <div
                                                                        className="total-label"
                                                                        style={{
                                                                            fontWeight: isCustomerSelected && !isDeleted ? 'bold' : 'normal',
                                                                            color: isDeleted ? '#991b1b' : (isCustomerSelected ? '#1e40af' : 'inherit'),
                                                                            textDecoration: isDeleted ? 'line-through' : 'none'
                                                                        }}
                                                                    >
                                                                        {order.business_invoice_type === 'official' ? 'با مالیات:' : 'جمع:'}
                                                                    </div>
                                                                    <div
                                                                        className="total-value"
                                                                        style={{
                                                                            fontWeight: isCustomerSelected && !isDeleted ? 'bold' : 'normal',
                                                                            color: isDeleted ? '#991b1b' : (isCustomerSelected ? '#1e40af' : 'inherit'),
                                                                            textDecoration: isDeleted ? 'line-through' : 'none'
                                                                        }}
                                                                    >
                                                                        {PersianNumberFormatter.formatPrice(
                                                                            calculateTotal(
                                                                                item[opt.value].price,
                                                                                item.final_quantity,
                                                                                item[opt.value].discount,
                                                                                order.business_invoice_type === 'official',
                                                                                item.product?.tax_rate || 10
                                                                            )
                                                                        )}
                                                                    </div>
                                                                    {order.business_invoice_type === 'official' && (
                                                                        <div className="tax-info" style={{
                                                                            fontSize: '0.75rem',
                                                                            color: isDeleted ? '#991b1b' : (isCustomerSelected ? '#1e40af' : '#6b7280'),
                                                                            marginTop: '0.25rem',
                                                                            fontWeight: isCustomerSelected && !isDeleted ? 'bold' : 'normal',
                                                                            textDecoration: isDeleted ? 'line-through' : 'none'
                                                                        }}>
                                                                            (شامل {item.product?.tax_rate || 10}% مالیات)
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span style={{ color: isDeleted ? '#991b1b' : 'inherit' }}>-</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}

                                    <td className="notes-cell">
                                        {editing && !readOnly && !isDeleted ? (
                                            <textarea
                                                className="item-notes-input"
                                                value={item.admin_notes}
                                                onChange={e => updateItemField(idx, 'admin_notes', e.target.value)}
                                                placeholder="توضیحات..."
                                                rows={2}
                                                disabled={readOnly || isDeleted}
                                            />
                                        ) : (
                                            <span style={{
                                                textDecoration: isDeleted ? 'line-through' : 'none',
                                                color: isDeleted ? '#991b1b' : 'inherit'
                                            }}>
                                                {item.admin_notes || '-'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="action-cell">
                                        {isDeleted ? (
                                            <div style={{
                                                textAlign: 'center',
                                                color: '#dc2626',
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold'
                                            }}>
                                                حذف شده
                                            </div>
                                        ) : (
                                            editing && !readOnly && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(item.id)}
                                                    className="remove-item-btn"
                                                >
                                                    🗑️
                                                </button>
                                            )
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>

                {!readOnly && editing && (
                    <div className="admin-edit-section" style={{ margin: '1rem 0' }}>
                        <NeoBrutalistButton
                            text="لغو ویرایش"
                            color="red-400"
                            textColor="white"
                            onClick={handleCancelEditing}
                            disabled={submitting}
                            className="admin-cancel-btn"
                            type="button"
                        />
                        <NeoBrutalistButton
                            text={submitting ? "در حال به‌روزرسانی..." : "به‌روزرسانی قیمت‌گذاری"}
                            color="blue-400"
                            textColor="white"
                            type="submit"
                            disabled={submitting}
                            className="admin-submit-btn"
                        />
                    </div>
                )}

                {/* Notify Customer Checkbox - Hide if readOnly or not editing */}
                {!readOnly && editing && (
                    <div className="customer-notification-section" style={{ marginBottom: '1rem' }}>
                        <label>
                            <input
                                type="checkbox"
                                checked={notifyCustomer}
                                onChange={e => setNotifyCustomer(e.target.checked)}
                            />
                            اطلاع‌رسانی تغییرات به مشتری (ارسال مجدد برای تأیید)
                        </label>
                    </div>
                )}

                {/* Locked Message for readOnly */}
                {readOnly && (
                    <div className="locked-message" style={{
                        backgroundColor: '#f3f4f6',
                        border: '2px solid #6b7280',
                        padding: '1rem',
                        borderRadius: '6px',
                        textAlign: 'center',
                        color: '#374151',
                        fontFamily: 'IRANSans, Tahoma, Arial, sans-serif',
                        marginTop: '1rem'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            🔒 ویرایش غیرفعال
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>
                            این سفارش تکمیل شده است و امکان ویرایش وجود ندارد.
                        </div>
                    </div>
                )}

                {/* Info Box */}
                <div className="pricing-info-box">
                    <strong>💡 راهنما:</strong>
                    <ul>
                        <li>{editing && !readOnly ? 'گزینه‌های موجود را ویرایش کنید یا با تیک "فعال" گزینه‌های جدید اضافه کنید (حداقل 2)' : 'فقط گزینه‌های انتخاب‌شده نمایش داده می‌شوند'}</li>
                        <li>{editing && !readOnly ? 'برای حذف گزینه، تیک "فعال" را بردارید' : 'برای ویرایش، روی دکمه ویرایش کلیک کنید'}</li>
                        <li>گزینه‌های با پس‌زمینه آبی = انتخاب مشتری</li>
                        <li>محصولات با پس‌زمینه قرمز = حذف شده توسط مشتری</li>
                    </ul>
                </div>
            </form>

            {readOnly && (
                <div className="locked-message" style={{
                    backgroundColor: '#f3f4f6',
                    border: '2px solid #6b7280',
                    padding: '1rem',
                    borderRadius: '6px',
                    textAlign: 'center',
                    color: '#374151',
                    fontFamily: 'IRANSans, Tahoma, Arial, sans-serif',
                    marginTop: '1rem'
                }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        🔒 ویرایش غیرفعال
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>
                        این سفارش تکمیل شده است و امکان ویرایش وجود ندارد.
                    </div>
                </div>
            )}
        </NeoBrutalistCard>
    );
};

export default AdminPricingEditSection;