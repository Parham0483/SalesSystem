// frontend/src/component/DealerAssignmentComponent.js - IMPROVED VERSION
import React, { useState, useEffect } from 'react';
import API from './api';
import NeoBrutalistDropdown from './NeoBrutalist/NeoBrutalistDropdown';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';

const DealerAssignmentComponent = ({ orderId, onDealerAssigned }) => {
    const [wantDealer, setWantDealer] = useState('no'); // 'no' | 'yes'
    const [dealers, setDealers] = useState([]);
    const [selectedDealer, setSelectedDealer] = useState('');
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

    const handleAssignDealer = async () => {
        if (!selectedDealer) {
            setError('لطفاً نماینده‌ای را انتخاب کنید');
            return;
        }

        setLoading(true);
        setError('');

        try {
            console.log('📤 Assigning dealer to order:', {
                orderId,
                dealer_id: parseInt(selectedDealer),
                dealer_notes: notes
            });

            const response = await API.post(`/orders/${orderId}/assign-dealer/`, {
                dealer_id: parseInt(selectedDealer),
                dealer_notes: notes
            });

            console.log('✅ Dealer assigned successfully:', response.data);
            alert('نماینده با موفقیت تخصیص داده شد!');

            // Reset form
            setWantDealer('no');
            setSelectedDealer('');
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
        label: `${dealer.name} - ${dealer.email} (${dealer.assigned_orders_count || 0} سفارش)`
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
                                    onChange={setSelectedDealer}
                                    placeholder="نماینده‌ای را انتخاب کنید..."
                                />
                            </div>

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
                                disabled={loading || !selectedDealer}
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