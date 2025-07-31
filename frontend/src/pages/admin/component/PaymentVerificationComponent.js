import React, { useState } from 'react';
import API from '../../../component/api';
import NeoBrutalistButton from "../../../component/NeoBrutalist/NeoBrutalistButton";
import neoBrutalistInput from "../../../component/NeoBrutalist/NeoBrutalistInput";
import '../../../styles/component/AdminComponent/PaymentVerification.css'

const PaymentVerificationComponent = ({ order, onPaymentVerified }) => {
    const [verifying, setVerifying] = useState(false);
    const [paymentNotes, setPaymentNotes] = useState('');
    const [error, setError] = useState('');

    const handleVerifyPayment = async (verified) => {
        if (!window.confirm(
            verified
                ? 'آیا مطمئن هستید که پرداخت را تایید و سفارش را تکمیل می‌کنید؟'
                : 'آیا مطمئن هستید که رسید پرداخت را رد می‌کنید؟'
        )) {
            return;
        }

        setVerifying(true);
        setError('');

        try {
            const response = await API.post(`/orders/${order.id}/verify-payment/`, {
                payment_verified: verified,
                payment_notes: paymentNotes
            });

            alert(verified ? 'پرداخت تایید شد و سفارش تکمیل گردید!' : 'رسید پرداخت رد شد');

            if (onPaymentVerified) {
                onPaymentVerified();
            }

        } catch (err) {
            console.error('❌ Payment verification failed:', err);
            const errorMessage = err.response?.data?.error || 'خطا در تایید پرداخت';
            setError(errorMessage);
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="payment-verification" dir="rtl">
            {error && (
                <div className="verification-error">
                    <span className="error-icon">⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            <div className="payment-receipt-section">
                <h3>رسید آپلود شده</h3>
                <div className="receipt-info">
                    <div className="receipt-meta">
                        <span>تاریخ آپلود: {new Date(order.payment_receipt_uploaded_at).toLocaleDateString('fa-IR')}</span>
                        <span>مبلغ سفارش: {new Intl.NumberFormat('fa-IR').format(order.quoted_total)} ریال</span>
                    </div>
                    <div className="receipt-image-container">
                        <img
                            src={order.payment_receipt}
                            alt="رسید پرداخت"
                            className="receipt-image"
                            onClick={() => window.open(order.payment_receipt, '_blank')}
                        />
                        <p className="receipt-hint">برای مشاهده در اندازه کامل کلیک کنید</p>
                    </div>
                </div>
            </div>

            <div className="verification-form">
                <div className="notes-section">
                    <label>یادداشت‌های پرداخت (اختیاری)</label>
                    <textarea
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="یادداشت‌های خود در مورد این پرداخت را وارد کنید..."
                        rows={3}
                        className="payment-notes-textarea"
                    />
                </div>

                <div className="verification-actions">
                    <NeoBrutalistButton
                        text={verifying ? "در حال تایید..." : "تایید پرداخت و تکمیل سفارش"}
                        color="green-400"
                        textColor="white"
                        onClick={() => handleVerifyPayment(true)}
                        disabled={verifying}
                        className="verify-btn"
                    />

                    <NeoBrutalistButton
                        text={verifying ? "در حال رد..." : "رد رسید پرداخت"}
                        color="red-400"
                        textColor="white"
                        onClick={() => handleVerifyPayment(false)}
                        disabled={verifying}
                        className="reject-btn"
                    />
                </div>
            </div>
        </div>
    );
};

export default PaymentVerificationComponent;