
import React, { useState, useEffect } from 'react';

export class PersianNumberFormatter {
    static formatPrice(price, showCurrency = true) {
        if (price === null || price === undefined || isNaN(price)) {
            return 'در انتظار';
        }

        const numericPrice = parseFloat(price);
        if (numericPrice === 0) {
            return 'در انتظار';
        }

        try {
            // Format with Persian locale and add spacing for readability
            const formatted = new Intl.NumberFormat('fa-IR').format(numericPrice);
            return showCurrency ? `${formatted} ریال` : formatted;
        } catch (error) {
            console.error('Persian price formatting error:', error, 'for price:', price);
            return showCurrency ? `${numericPrice} ریال` : numericPrice.toString();
        }
    }

    /**
     * Format quantity with Persian digits
     */
    static formatQuantity(quantity) {
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
            console.error('Persian quantity formatting error:', error, 'for quantity:', quantity);
            return numericQuantity.toString();
        }
    }

    /**
     * Calculate and format total with live updates
     */
    static calculateAndFormatTotal(unitPrice, quantity, showCurrency = true) {
        if (!unitPrice || !quantity || unitPrice === 0 || quantity === 0) {
            return 'در انتظار';
        }

        const total = parseFloat(unitPrice) * parseInt(quantity);
        return this.formatPrice(total, showCurrency);
    }

    /**
     * Calculate tax amount for official invoices
     */
    static calculateTax(unitPrice, quantity, taxRate) {
        if (!unitPrice || !quantity || !taxRate) return 0;

        const subtotal = parseFloat(unitPrice) * parseInt(quantity);
        return subtotal * (parseFloat(taxRate) / 100);
    }

    /**
     * Calculate total with tax for official invoices
     */
    static calculateTotalWithTax(unitPrice, quantity, taxRate) {
        if (!unitPrice || !quantity) return 0;

        const subtotal = parseFloat(unitPrice) * parseInt(quantity);
        const tax = taxRate ? this.calculateTax(unitPrice, quantity, taxRate) : 0;
        return subtotal + tax;
    }

    /**
     * Auto-format input value as user types
     */
    static autoFormatInput(value, inputElement) {
        if (!value || value === '') return '';

        // Remove all non-digit characters except decimal point
        const cleanValue = value.toString().replace(/[^\d.]/g, '');

        // Parse and format
        const numericValue = parseFloat(cleanValue);
        if (isNaN(numericValue)) return '';

        // Format with Persian digits and update input
        const formatted = this.formatPrice(numericValue, false);

        // Update input display value if element provided
        if (inputElement) {
            // Store the numeric value as data attribute for calculations
            inputElement.dataset.numericValue = numericValue;
            inputElement.value = formatted;
        }

        return formatted;
    }

    /**
     * Get numeric value from formatted input
     */
    static getNumericValue(inputElement) {
        if (inputElement.dataset.numericValue) {
            return parseFloat(inputElement.dataset.numericValue);
        }

        // Fallback: parse from display value
        const displayValue = inputElement.value;
        const cleanValue = displayValue.replace(/[^\d.]/g, '');
        return parseFloat(cleanValue) || 0;
    }

    /**
     * Format input on blur event
     */
    static handleInputBlur(event) {
        const input = event.target;
        const value = input.value;

        if (value && value !== '') {
            const formatted = this.autoFormatInput(value, input);
            input.value = formatted;
        }
    }

    /**
     * Handle input focus - show raw number for editing
     */
    static handleInputFocus(event) {
        const input = event.target;
        const numericValue = this.getNumericValue(input);

        if (numericValue > 0) {
            input.value = numericValue.toString();
        }
    }
}

// Enhanced Input Component with Auto-formatting
export const PersianFormattedInput = ({
                                          value,
                                          onChange,
                                          onBlur,
                                          placeholder,
                                          disabled,
                                          type = "number",
                                          min = "0",
                                          step = "1000",
                                          className = "",
                                          style = {},
                                          ...props
                                      }) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused && value) {
            setDisplayValue(PersianNumberFormatter.formatPrice(value, false));
        }
    }, [value, isFocused]);

    const handleFocus = (e) => {
        setIsFocused(true);
        // Show raw number for editing
        if (value && value > 0) {
            setDisplayValue(value.toString());
        }
    };

    const handleBlur = (e) => {
        setIsFocused(false);
        const numericValue = parseFloat(e.target.value) || 0;

        // Update parent with numeric value
        if (onChange) {
            onChange({ target: { value: numericValue } });
        }

        // Format display value
        if (numericValue > 0) {
            setDisplayValue(PersianNumberFormatter.formatPrice(numericValue, false));
        } else {
            setDisplayValue('');
        }

        if (onBlur) {
            onBlur(e);
        }
    };

    const handleChange = (e) => {
        const newValue = e.target.value;
        setDisplayValue(newValue);

        // Send numeric value to parent during typing
        const numericValue = parseFloat(newValue.replace(/[^\d.]/g, '')) || 0;
        if (onChange) {
            onChange({ target: { value: numericValue } });
        }
    };

    return (
        <input
            type="text"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={`persian-formatted-input ${className}`}
            style={{
                textAlign: 'center',
                direction: 'ltr',
                fontFamily: 'Tahoma, Arial, sans-serif',
                ...style
            }}
            {...props}
        />
    );
};

// CSS for proper RTL and Persian number display
export const persianNumberStyles = `
.persian-formatted-input {
    width: 100%;
    padding: 0.75rem;
    font-size: 0.9rem;
    text-align: center;
    direction: ltr;
    font-family: 'Tahoma', 'Arial', sans-serif;
    border: 4px solid #000;
    box-shadow: 6px 6px 0 #000;
    background-color: white;
    color: #1a1a1a;
    outline: none;
    transition: all 0.2s ease;
}

.persian-formatted-input:focus {
    box-shadow: 4px 4px 0 #000;
    transform: translate(2px, 2px);
    outline: 2px solid #000;
    outline-offset: 2px;
}

.persian-formatted-input:hover:not(:disabled) {
    box-shadow: 4px 4px 0 #000;
    transform: translate(2px, 2px);
}

.persian-formatted-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: #f5f5f5;
}

.persian-formatted-input::placeholder {
    color: #666;
    opacity: 0.7;
}

.admin-table-cell.admin-total-cell {
    font-weight: bold;
    color: #059669;
    font-size: 1rem;
    font-family: 'Tahoma', sans-serif;
    direction: rtl;
    text-align: center;
}

.admin-table-cell.admin-tax-cell {
    font-weight: bold;
    color: #dc2626;
    font-size: 0.95rem;
    font-family: 'Tahoma', sans-serif;
    direction: rtl;
    text-align: center;
}

.tax-rate-display {
    font-weight: bold;
    color: #059669;
    font-size: 0.9rem;
    direction: rtl;
}

.total-breakdown {
    text-align: right;
    direction: rtl;
    font-family: 'Tahoma', sans-serif;
}

.total-breakdown .total-final {
    font-weight: bold;
    color: #dc2626;
    border-top: 2px solid #ddd;
    padding-top: 0.5rem;
    margin-top: 0.5rem;
}

/* Live calculation indicators */
.live-calculation {
    color: #059669;
    font-weight: bold;
    transition: all 0.3s ease;
}

.live-calculation.updating {
    color: #f59e0b;
    background-color: #fef3c7;
    padding: 2px 4px;
    border-radius: 2px;
}
`;

// Usage example for AdminPricingEditSection component
export const enhancedAdminPricingExample = `
// In AdminPricingEditSection.js - Enhanced implementation

import { PersianNumberFormatter, PersianFormattedInput } from './utils/persianNumberFormatter';

// Enhanced calculation functions
const calculateItemTax = (unitPrice, quantity, taxRate) => {
    return PersianNumberFormatter.calculateTax(unitPrice, quantity, taxRate);
};

const calculateItemTotalWithTax = (unitPrice, quantity, taxRate) => {
    return PersianNumberFormatter.calculateTotalWithTax(unitPrice, quantity, taxRate);
};

// Enhanced total calculation with live updates
const calculateOrderTotal = () => {
    const subtotal = items.reduce((sum, item) => {
        if (item.quoted_unit_price && item.final_quantity) {
            return sum + (parseFloat(item.quoted_unit_price) * parseInt(item.final_quantity));
        }
        return sum;
    }, 0);

    if (subtotal === 0) return 'در انتظار محاسبه';

    if (order.business_invoice_type === 'official') {
        const totalTax = items.reduce((sum, item) => {
            const itemTax = calculateItemTax(item.quoted_unit_price, item.final_quantity, item.product_tax_rate);
            return sum + itemTax;
        }, 0);

        const totalWithTax = subtotal + totalTax;

        return (
            <div className="total-breakdown">
                <div>مجموع: {PersianNumberFormatter.formatPrice(subtotal)}</div>
                <div>مالیات: {PersianNumberFormatter.formatPrice(totalTax)}</div>
                <div className="total-final">کل با مالیات: {PersianNumberFormatter.formatPrice(totalWithTax)}</div>
            </div>
        );
    }

    return PersianNumberFormatter.formatPrice(subtotal);
};

// Enhanced table row rendering
{items.map((item, idx) => (
    <div key={item.id} className="admin-table-row">
        <div className="admin-table-cell admin-product-name" title={item.product_name}>
            {item.product_name}
        </div>
        <div className="admin-table-cell">
            {PersianNumberFormatter.formatQuantity(item.requested_quantity)}
        </div>
        <div className="admin-table-cell admin-customer-notes" title={item.customer_notes}>
            {item.customer_notes || '-'}
        </div>
        <div className="admin-table-cell admin-input-cell">
            <PersianFormattedInput
                value={item.quoted_unit_price || ''}
                onChange={e => updateItem(idx, 'quoted_unit_price', e.target.value)}
                placeholder="قیمت"
                min="0"
                step="1000"
                disabled={!canEdit}
                style={{
                    opacity: canEdit ? 1 : 0.6,
                    cursor: canEdit ? 'text' : 'not-allowed'
                }}
            />
        </div>
        <div className="admin-table-cell admin-input-cell">
            <PersianFormattedInput
                value={item.final_quantity || ''}
                onChange={e => updateItem(idx, 'final_quantity', e.target.value)}
                placeholder="تعداد"
                min="0"
                disabled={!canEdit}
                style={{
                    opacity: canEdit ? 1 : 0.6,
                    cursor: canEdit ? 'text' : 'not-allowed'
                }}
            />
        </div>

        {isOfficialInvoice && (
            <>
                <div className="admin-table-cell">
                    <span className="tax-rate-display">
                        {item.product_tax_rate ? \`\${parseFloat(item.product_tax_rate).toFixed(1)}%\` : '0%'}
                    </span>
                </div>
                <div className="admin-table-cell admin-tax-cell">
                    <span className="live-calculation">
                        {PersianNumberFormatter.formatPrice(
                            calculateItemTax(item.quoted_unit_price, item.final_quantity, item.product_tax_rate)
                        )}
                    </span>
                </div>
            </>
        )}

        <div className="admin-table-cell admin-input-cell">
            <NeoBrutalistInput
                type="text"
                value={item.admin_notes || ''}
                onChange={e => updateItem(idx, 'admin_notes', e.target.value)}
                placeholder="نظر مدیر"
                disabled={!canEdit}
                style={{
                    opacity: canEdit ? 1 : 0.6,
                    cursor: canEdit ? 'text' : 'not-allowed'
                }}
            />
        </div>
        <div className="admin-table-cell admin-total-cell">
            <span className="live-calculation">
                {isOfficialInvoice
                    ? PersianNumberFormatter.formatPrice(
                        calculateItemTotalWithTax(item.quoted_unit_price, item.final_quantity, item.product_tax_rate)
                    )
                    : PersianNumberFormatter.formatPrice(
                        PersianNumberFormatter.calculateAndFormatTotal(item.quoted_unit_price, item.final_quantity, false)
                    )
                }
            </span>
        </div>
    </div>
))}
`;