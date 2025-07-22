import React, { useState, useEffect } from 'react';
import API from '../api';
import NeoBrutalistButton from '../NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistDropdown from '../NeoBrutalist/NeoBrutalistDropdown';
import NeoBrutalistInput from '../NeoBrutalist/NeoBrutalistInput';

const DealerAssignmentComponent = ({ orderId, onDealerAssigned }) => {
    const [dealers, setDealers] = useState([]);
    const [selectedDealer, setSelectedDealer] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDealers();
    }, []);

    const fetchDealers = async () => {
        try {
            const response = await API.get('/dealers/list-for-assignment/');
            setDealers(response.data.dealers);
        } catch (err) {
            console.error('Error fetching dealers:', err);
            setError('خطا در بارگیری نمایندگان');
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
            await API.post(`/orders/${orderId}/assign-dealer/`, {
                dealer_id: parseInt(selectedDealer),
                notes: notes
            });

            alert('نماینده با موفقیت تخصیص داده شد!');

            if (onDealerAssigned) {
                onDealerAssigned();
            }
        } catch (err) {
            console.error('Error assigning dealer:', err);
            setError(err.response?.data?.error || 'خطا در تخصیص نماینده');
        } finally {
            setLoading(false);
        }
    };

    const dealerOptions = dealers.map(dealer => ({
        value: dealer.id.toString(),
        label: `${dealer.name} (${dealer.assigned_orders_count} سفارش)`
    }));

    return (
        <div className="dealer-assignment-form">
            {error && (
                <div className="error-message">
                    <span>⚠️ {error}</span>
                </div>
            )}

            <div className="form-group">
                <NeoBrutalistDropdown
                    label="انتخاب نماینده فروش"
                    options={dealerOptions}
                    value={selectedDealer}
                    onChange={setSelectedDealer}
                    placeholder="نماینده‌ای را انتخاب کنید..."
                />
            </div>

            <div className="form-group">
                <NeoBrutalistInput
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="یادداشت‌های اضافی (اختیاری)..."
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
        </div>
    );
};

export default DealerAssignmentComponent;