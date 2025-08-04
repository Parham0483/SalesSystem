import React, { useState, useEffect } from 'react';
import API from './api';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';

const CustomerInfoManagement = ({ onClose, onUpdate }) => {
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: '',
        company_name: '',
        national_id: '',
        economic_id: '',
        postal_code: '',
        complete_address: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [errors, setErrors] = useState({});

    useEffect(() => {
        loadCustomerInfo();
    }, []);

    const loadCustomerInfo = async () => {
        setLoading(true);
        try {
            const response = await API.get('/customers/invoice-info/');
            if (response.status === 200) {
                setCustomerInfo(response.data.customer_info);
                console.log('✅ Customer info loaded:', response.data);
            }
        } catch (err) {
            console.error('❌ Error loading customer info:', err);
            setError('خطا در بارگیری اطلاعات');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field, value) => {
        setCustomerInfo(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }

        // Clear success message when user starts editing
        if (success) {
            setSuccess('');
        }
    };

    const validateForm = () => {
        const newErrors = {};

        // Basic validations
        if (!customerInfo.name?.trim()) {
            newErrors.name = 'نام الزامی است';
        }

        if (!customerInfo.phone?.trim()) {
            newErrors.phone = 'شماره تماس الزامی است';
        } else if (!/^09\d{9}$/.test(customerInfo.phone)) {
            newErrors.phone = 'شماره تماس باید با 09 شروع شده و 11 رقم باشد';
        }

        if (customerInfo.national_id && customerInfo.national_id.length < 8) {
            newErrors.national_id = 'شناسه ملی باید حداقل 8 رقم باشد';
        }

        if (customerInfo.postal_code && (customerInfo.postal_code.length !== 10 || !/^\d+$/.test(customerInfo.postal_code))) {
            newErrors.postal_code = 'کد پستی باید دقیقاً 10 رقم باشد';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const response = await API.post('/customers/update-invoice-info/', {
                invoice_type: 'official', // Always validate as official for complete info
                customer_info: customerInfo
            });

            if (response.status === 200) {
                setSuccess('اطلاعات با موفقیت به‌روزرسانی شد');
                console.log('✅ Customer info updated:', response.data);

                if (onUpdate) {
                    onUpdate(response.data.customer_info);
                }

                // Auto close after 2 seconds
                setTimeout(() => {
                    if (onClose) {
                        onClose();
                    }
                }, 2000);
            }
        } catch (err) {
            console.error('❌ Error updating customer info:', err);

            if (err.response?.data?.details) {
                setErrors(err.response.data.details);
            } else {
                setError(err.response?.data?.error || 'خطا در به‌روزرسانی اطلاعات');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="customer-info-overlay">
                <NeoBrutalistCard className="customer-info-modal">
                    <div className="loading-content">
                        <span>🔄</span>
                        <span>در حال بارگیری اطلاعات...</span>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    return (
        <div className="customer-info-overlay" dir="rtl">
            <NeoBrutalistCard className="customer-info-modal">
                <div className="modal-header">
                    <h2>ویرایش اطلاعات شخصی</h2>
                    <button className="close-button" onClick={onClose}>✕</button>
                </div>

                {error && (
                    <div className="error-message">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="success-message">
                        <span>✅</span>
                        <span>{success}</span>
                    </div>
                )}

                <div className="customer-form">
                    <div className="form-section">
                        <h3>اطلاعات پایه</h3>
                        <div className="form-row">
                            <div className="form-field">
                                <NeoBrutalistInput
                                    label="نام کامل"
                                    value={customerInfo.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    error={errors.name}
                                    placeholder="مثال: علی احمدی"
                                />
                            </div>
                            <div className="form-field">
                                <NeoBrutalistInput
                                    label="شماره تماس"
                                    value={customerInfo.phone}
                                    onChange={(e) => handleInputChange('phone', e.target.value)}
                                    error={errors.phone}
                                    placeholder="مثال: 09123456789"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-field">
                                <NeoBrutalistInput
                                    label="نام شرکت (اختیاری)"
                                    value={customerInfo.company_name}
                                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                                    placeholder="مثال: شرکت نمونه"
                                />
                            </div>
                            <div className="form-field">
                                <NeoBrutalistInput
                                    label="کد ملی"
                                    value={customerInfo.national_id}
                                    onChange={(e) => handleInputChange('national_id', e.target.value)}
                                    error={errors.national_id}
                                    placeholder="مثال: 0123456789"
                                    maxLength="10"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-field">
                                <NeoBrutalistInput
                                    label="شناسه اقتصادی (اختیاری)"
                                    value={customerInfo.economic_id}
                                    onChange={(e) => handleInputChange('economic_id', e.target.value)}
                                    placeholder="مثال: 12345678901"
                                />
                            </div>
                            <div className="form-field">
                                <NeoBrutalistInput
                                    label="کد پستی"
                                    value={customerInfo.postal_code}
                                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                                    error={errors.postal_code}
                                    placeholder="مثال: 1234567890"
                                    maxLength="10"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="textarea-group">
                                <label className="textarea-label">آدرس کامل</label>
                                <textarea
                                    className={`customer-textarea ${errors.complete_address ? 'error' : ''}`}
                                    value={customerInfo.complete_address}
                                    onChange={(e) => handleInputChange('complete_address', e.target.value)}
                                    placeholder="مثال: تهران، خیابان آزادی، پلاک 123، طبقه 2"
                                    rows={3}
                                />
                                {errors.complete_address && (
                                    <span className="error-text">{errors.complete_address}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="form-actions">
                        <NeoBrutalistButton
                            text={saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
                            color="green-400"
                            textColor="black"
                            onClick={handleSave}
                            disabled={saving}
                        />
                        <NeoBrutalistButton
                            text="انصراف"
                            color="gray-400"
                            textColor="black"
                            onClick={onClose}
                            disabled={saving}
                        />
                    </div>
                </div>
            </NeoBrutalistCard>

            <style jsx>{`
                .customer-info-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 2rem;
                }

                .customer-info-modal {
                    width: 100%;
                    max-width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                    background: white;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 2px solid #000;
                }

                .modal-header h2 {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: #1f2937;
                }

                .close-button {
                    background: #ef4444;
                    color: white;
                    border: 2px solid #000;
                    border-radius: 4px;
                    padding: 0.5rem;
                    cursor: pointer;
                    font-weight: bold;
                    font-size: 1.2rem;
                }

                .close-button:hover {
                    background: #dc2626;
                }

                .loading-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                    padding: 2rem;
                    font-size: 1.1rem;
                }

                .error-message, .success-message {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 1rem;
                    border-radius: 6px;
                    margin-bottom: 1rem;
                    font-weight: bold;
                }

                .error-message {
                    background: #fef2f2;
                    color: #dc2626;
                    border: 2px solid #fca5a5;
                }

                .success-message {
                    background: #f0fdf4;
                    color: #16a34a;
                    border: 2px solid #86efac;
                }

                .customer-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .form-section {
                    padding: 1rem;
                    border: 2px solid #e5e7eb;
                    border-radius: 6px;
                    background: #f9fafb;
                }

                .form-section h3 {
                    font-size: 1.2rem;
                    font-weight: bold;
                    color: #374151;
                    margin-bottom: 1rem;
                    border-bottom: 1px solid #d1d5db;
                    padding-bottom: 0.5rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                @media (max-width: 640px) {
                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }

                .form-field {
                    display: flex;
                    flex-direction: column;
                }

                .textarea-group {
                    grid-column: 1 / -1;
                }

                .textarea-label {
                    font-weight: bold;
                    color: #374151;
                    margin-bottom: 0.5rem;
                    display: block;
                }

                .customer-textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 2px solid #d1d5db;
                    border-radius: 6px;
                    font-family: inherit;
                    font-size: 1rem;
                    resize: vertical;
                    transition: border-color 0.2s;
                }

                .customer-textarea:focus {
                    outline: none;
                    border-color: #3b82f6;
                }

                .customer-textarea.error {
                    border-color: #ef4444;
                }

                .error-text {
                    color: #ef4444;
                    font-size: 0.875rem;
                    margin-top: 0.25rem;
                    display: block;
                }

                .form-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                    padding-top: 1rem;
                    border-top: 2px solid #e5e7eb;
                }

                @media (max-width: 640px) {
                    .form-actions {
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
};

export default CustomerInfoManagement;