// frontend/src/component/DealerAssignmentComponent.js - ENHANCED VERSION
import React, { useState, useEffect } from 'react';
import API from './api';
import NeoBrutalistDropdown from './NeoBrutalist/NeoBrutalistDropdown';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';

const DealerAssignmentComponent = ({ orderId, onDealerAssigned }) => {
    const [wantDealer, setWantDealer] = useState('no'); // 'no' | 'yes'
    const [dealers, setDealers] = useState([]);
    const [selectedDealer, setSelectedDealer] = useState('');
    const [selectedDealerInfo, setSelectedDealerInfo] = useState(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Only fetch dealers if user wants to assign one
        if (wantDealer === 'yes') {
            fetchDealers();
        }
    }, [wantDealer]);

    const fetchDealers = async () => {
        try {
            console.log('🔍 Fetching dealers for assignment...');
            const response = await API.get('/dealers/list-for-assignment/');
            console.log('✅ Dealers fetched:', response.data);
            setDealers(response.data.dealers || []);
        } catch (err) {
            console.error('❌ Error fetching dealers:', err);
            setError('خطا در بارگیری نمایندگان فروش');
        }
    };

    const handleDealerSelect = (dealerId) => {
        setSelectedDealer(dealerId);
        const dealer = dealers.find(d => d.id.toString() === dealerId);
        setSelectedDealerInfo(dealer || null);
        console.log('🎯 Selected dealer:', dealer);
    };

    const handleAssignDealer = async () => {
        if (!selectedDealer) {
            setError('لطفاً نماینده‌ای را انتخاب کنید');
            return;
        }

        // Validate commission rate
        if (!selectedDealerInfo || selectedDealerInfo.commission_rate <= 0) {
            setError('نماینده انتخابی نرخ کمیسیون معتبری ندارد. لطفاً ابتدا نرخ کمیسیون را تنظیم کنید.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            console.log('📤 Assigning dealer to order:', {
                orderId,
                dealer_id: parseInt(selectedDealer),
                dealer_notes: notes,
                commission_rate: selectedDealerInfo.commission_rate
            });

            const response = await API.post(`/orders/${orderId}/assign-dealer/`, {
                dealer_id: parseInt(selectedDealer),
                dealer_notes: notes
            });

            console.log('✅ Dealer assigned successfully:', response.data);

            const successMessage = `نماینده ${selectedDealerInfo.name} با موفقیت تخصیص داده شد!\nنرخ کمیسیون: ${selectedDealerInfo.commission_rate}%`;
            alert(successMessage);

            // Reset form
            setWantDealer('no');
            setSelectedDealer('');
            setSelectedDealerInfo(null);
            setNotes('');

            // Notify parent component
            if (onDealerAssigned) {
                onDealerAssigned();
            }

        } catch (err) {
            console.error('❌ Error assigning dealer:', err);
            const errorMessage = err.response?.data?.error ||
                err.response?.data?.details ||
                'خطا در تخصیص نماینده';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const dealerOptions = dealers.map(dealer => ({
        value: dealer.id.toString(),
        label: `${dealer.name} - ${dealer.email} (${dealer.assigned_orders_count || 0} سفارش) - کمیسیون: ${dealer.commission_rate}%`
    }));

    return (
        <div className="dealer-assignment-form" dir="rtl">
            {error && (
                <div className="error-message" style={{
                    backgroundColor: '#fef2f2',
                    border: '2px solid #ef4444',
                    padding: '1rem',
                    marginBottom: '1rem',
                    color: '#dc2626',
                    fontWeight: 'bold',
                    textAlign: 'right'
                }}>
                    <span>⚠️ {error}</span>
                </div>
            )}

            {/* Step 1: Ask if they want to assign a dealer */}
            <div className="dealer-question" style={{ marginBottom: '1.5rem' }}>
                <h4 style={{
                    marginBottom: '1rem',
                    fontFamily: 'Tahoma, sans-serif',
                    textAlign: 'right',
                    fontSize: '1.1rem',
                    fontWeight: 'bold'
                }}>
                    آیا می‌خواهید نماینده فروش به این سفارش تخصیص دهید؟
                </h4>

                <div className="radio-group" style={{
                    display: 'flex',
                    gap: '1.5rem',
                    direction: 'rtl',
                    justifyContent: 'flex-start'
                }}>
                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontFamily: 'Tahoma, sans-serif',
                        fontSize: '1rem'
                    }}>
                        <input
                            type="radio"
                            name="wantDealer"
                            value="no"
                            checked={wantDealer === 'no'}
                            onChange={(e) => {
                                setWantDealer(e.target.value);
                                setSelectedDealer('');
                                setSelectedDealerInfo(null);
                                setNotes('');
                                setError('');
                            }}
                            style={{
                                width: '18px',
                                height: '18px',
                                marginLeft: '0.5rem'
                            }}
                        />
                        خیر، فعلاً نیازی نیست
                    </label>

                    <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        fontFamily: 'Tahoma, sans-serif',
                        fontSize: '1rem'
                    }}>
                        <input
                            type="radio"
                            name="wantDealer"
                            value="yes"
                            checked={wantDealer === 'yes'}
                            onChange={(e) => {
                                setWantDealer(e.target.value);
                                setError('');
                            }}
                            style={{
                                width: '18px',
                                height: '18px',
                                marginLeft: '0.5rem'
                            }}
                        />
                        بله، نماینده تخصیص دهید
                    </label>
                </div>
            </div>

            {/* Step 2: Show dealer selection if they want to assign */}
            {wantDealer === 'yes' && (
                <div className="dealer-selection" style={{
                    backgroundColor: '#f8f9fa',
                    border: '3px solid #000',
                    padding: '1.5rem',
                    marginTop: '1rem'
                }}>
                    <h5 style={{
                        marginBottom: '1rem',
                        fontFamily: 'Tahoma, sans-serif',
                        textAlign: 'right',
                        fontSize: '1rem',
                        fontWeight: 'bold'
                    }}>
                        انتخاب نماینده فروش:
                    </h5>

                    {dealers.length === 0 ? (
                        <div style={{
                            padding: '1rem',
                            textAlign: 'center',
                            color: '#666',
                            fontFamily: 'Tahoma, sans-serif'
                        }}>
                            🔄 در حال بارگیری نمایندگان...
                        </div>
                    ) : (
                        <>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <NeoBrutalistDropdown
                                    label="نماینده فروش"
                                    options={dealerOptions}
                                    value={selectedDealer}
                                    onChange={handleDealerSelect}
                                    placeholder="نماینده‌ای را انتخاب کنید..."
                                />
                            </div>

                            {/* Show selected dealer info */}
                            {selectedDealerInfo && (
                                <div className="dealer-info-card" style={{
                                    backgroundColor: '#e0f7fa',
                                    border: '2px solid #00acc1',
                                    padding: '1rem',
                                    marginBottom: '1rem',
                                    fontFamily: 'Tahoma, sans-serif'
                                }}>
                                    <h6 style={{ margin: '0 0 0.5rem 0', color: '#006064' }}>
                                        📋 اطلاعات نماینده انتخاب شده:
                                    </h6>
                                    <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                                        <div><strong>نام:</strong> {selectedDealerInfo.name}</div>
                                        <div><strong>ایمیل:</strong> {selectedDealerInfo.email}</div>
                                        <div><strong>کد نماینده:</strong> {selectedDealerInfo.dealer_code || 'ندارد'}</div>
                                        <div><strong>نرخ کمیسیون:</strong>
                                            <span style={{
                                                color: selectedDealerInfo.commission_rate > 0 ? '#2e7d32' : '#d32f2f',
                                                fontWeight: 'bold',
                                                marginRight: '0.25rem'
                                            }}>
                                                {selectedDealerInfo.commission_rate}%
                                            </span>
                                        </div>
                                        <div><strong>سفارشات فعال:</strong> {selectedDealerInfo.active_orders_count || 0}</div>
                                        <div><strong>مجموع سفارشات:</strong> {selectedDealerInfo.assigned_orders_count || 0}</div>
                                    </div>

                                    {selectedDealerInfo.commission_rate <= 0 && (
                                        <div style={{
                                            backgroundColor: '#ffebee',
                                            border: '1px solid #f44336',
                                            padding: '0.5rem',
                                            marginTop: '0.5rem',
                                            color: '#c62828',
                                            fontSize: '0.85rem'
                                        }}>
                                            ⚠️ هشدار: این نماینده نرخ کمیسیون معتبری ندارد
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{
                                    display: 'block',
                                    marginBottom: '0.5rem',
                                    fontFamily: 'Tahoma, sans-serif',
                                    fontWeight: 'bold',
                                    textAlign: 'right'
                                }}>
                                    یادداشت‌های اضافی (اختیاری):
                                </label>
                                <NeoBrutalistInput
                                    type="text"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="توضیحات یا یادداشت‌های مربوط به تخصیص نماینده..."
                                />
                            </div>

                            <NeoBrutalistButton
                                text={loading ? "در حال تخصیص..." : "تخصیص نماینده"}
                                color="blue-400"
                                textColor="white"
                                onClick={handleAssignDealer}
                                disabled={loading || !selectedDealer || (selectedDealerInfo && selectedDealerInfo.commission_rate <= 0)}
                                className="assign-dealer-btn"
                            />
                        </>
                    )}
                </div>
            )}

            {/* Success message */}
            {wantDealer === 'no' && (
                <div style={{
                    backgroundColor: '#e0f2fe',
                    border: '2px solid #0284c7',
                    padding: '1rem',
                    marginTop: '1rem',
                    textAlign: 'right',
                    fontFamily: 'Tahoma, sans-serif',
                    color: '#0284c7'
                }}>
                    ✅ این سفارش بدون نماینده باقی خواهد ماند. می‌توانید بعداً نماینده تخصیص دهید.
                </div>
            )}
        </div>
    );
};

export default DealerAssignmentComponent;