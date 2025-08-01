import React, { useState, useEffect } from 'react';
import API from '../../../component/api';
import NeoBrutalistButton from "../../../component/NeoBrutalist/NeoBrutalistButton";
import NeoBrutalistCard from "../../../component/NeoBrutalist/NeoBrutalistCard";
import '../../../styles/component/AdminComponent/PaymentVerification.css'

const PaymentVerificationComponent = ({ order, onPaymentVerified }) => {
    const [verifying, setVerifying] = useState(false);
    const [paymentNotes, setPaymentNotes] = useState('');
    const [error, setError] = useState('');
    const [paymentReceipts, setPaymentReceipts] = useState([]);
    const [loadingReceipts, setLoadingReceipts] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedImages, setSelectedImages] = useState([]);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    useEffect(() => {
        if (order && (order.status === 'payment_uploaded' || order.has_payment_receipts)) {
            fetchPaymentReceipts();
        }
    }, [order]);

    const fetchPaymentReceipts = async () => {
        setLoadingReceipts(true);
        try {
            const response = await API.get(`/orders/${order.id}/payment-receipts/`);
            setPaymentReceipts(response.data.receipts || []);
        } catch (err) {
            console.error('❌ Error fetching payment receipts:', err);
            setError('خطا در بارگیری رسیدهای پرداخت');
        } finally {
            setLoadingReceipts(false);
        }
    };

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

    const handleImageClick = (receipts, startIndex = 0) => {
        const images = receipts.filter(receipt => receipt.file_type === 'image');
        if (images.length > 0) {
            setSelectedImages(images);
            setCurrentImageIndex(startIndex);
            setIsImageModalOpen(true);
        }
    };

    const nextImage = () => {
        setCurrentImageIndex((prev) =>
            prev === selectedImages.length - 1 ? 0 : prev + 1
        );
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) =>
            prev === 0 ? selectedImages.length - 1 : prev - 1
        );
    };

    const handleViewPDF = async (receipt) => {

        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write('در حال بارگیری PDF...');
        }

        try {
            // 2. Fetch the PDF data from the server.
            const response = await API.get(`/receipts/${receipt.id}/view/`, {
                responseType: 'blob'
            });

            // 3. Create a temporary URL from the received data.
            const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
            const previewUrl = window.URL.createObjectURL(pdfBlob);

            // 4. If the window is still open, set its location to the new PDF URL.
            if (newWindow) {
                newWindow.location.href = previewUrl;
            } else {
                // Fallback for browsers that might still block the initial open
                alert('Pop-up blocker may be preventing the PDF from opening. Please allow pop-ups for this site.');
            }

        } catch (error) {
            console.error('❌ Error fetching PDF for preview:', error);
            // If an error occurs, close the blank tab.
            if (newWindow) {
                newWindow.close();
            }
            alert('خطا در مشاهده فایل PDF. لطفاً دوباره تلاش کنید.');
        }
    };

    // FIXED: Download function with proper authentication
    const handleDownloadReceipt = async (receipt) => {
        try {
            const downloadUrl = receipt.download_url;

            if (!downloadUrl) {
                alert('لینک دانلود در دسترس نیست');
                return;
            }

            const token = localStorage.getItem('access_token');
            if (!token) {
                alert('لطفاً دوباره وارد شوید');
                return;
            }

            // FIXED: Proper authenticated download
            try {
                const response = await fetch(downloadUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                // Get the blob
                const blob = await response.blob();

                // Create download link
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = receipt.file_name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Clean up
                URL.revokeObjectURL(blobUrl);

            } catch (fetchError) {
                console.error('❌ Error downloading file:', fetchError);
                alert('خطا در دانلود فایل. لطفاً دوباره تلاش کنید.');
            }

        } catch (error) {
            console.error('❌ Error in download handler:', error);
            alert('خطا در دانلود فایل');
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="payment-verification" dir="rtl">
            {error && (
                <div className="verification-error">
                    <span className="error-icon">⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {/* Multiple Payment Receipts Support */}
            {paymentReceipts.length > 0 ? (
                <div className="payment-receipts-section">
                    <h3>رسیدهای پرداخت ({paymentReceipts.length})</h3>

                    <div className="receipts-summary">
                        <div className="summary-item">
                            <span>مبلغ سفارش: {new Intl.NumberFormat('fa-IR').format(order.quoted_total)} ریال</span>
                        </div>
                        <div className="summary-item">
                            <span>تعداد رسیدها: {paymentReceipts.length}</span>
                        </div>
                        <div className="summary-item">
                            <span>تایید شده: {paymentReceipts.filter(r => r.is_verified).length}</span>
                        </div>
                    </div>

                    <div className="receipts-grid">
                        {paymentReceipts.map((receipt, index) => (
                            <NeoBrutalistCard key={receipt.id} className="receipt-card">
                                <div className="receipt-header">
                                    <h4>رسید {index + 1}</h4>
                                    <div className="receipt-meta">
                                        <span className="receipt-type">
                                            {receipt.file_type === 'pdf' ? ' PDF' : ' تصویر'}
                                        </span>
                                        <span className="receipt-size">
                                            {formatFileSize(receipt.file_size)}
                                        </span>
                                        <span className={`receipt-status ${receipt.is_verified ? 'verified' : 'pending'}`}>
                                            {receipt.is_verified ? '✅ تایید شده' : ' در انتظار بررسی'}
                                        </span>
                                    </div>
                                </div>

                                <div className="receipt-info">
                                    <div className="receipt-details">
                                        <div className="detail-item">
                                            <span className="detail-label">نام فایل:</span>
                                            <span className="detail-value">{receipt.file_name}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">تاریخ آپلود:</span>
                                            <span className="detail-value">
                                                {new Date(receipt.uploaded_at).toLocaleDateString('fa-IR')}
                                            </span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="detail-label">آپلود شده توسط:</span>
                                            <span className="detail-value">{receipt.uploaded_by}</span>
                                        </div>
                                        {receipt.admin_notes && (
                                            <div className="detail-item">
                                                <span className="detail-label">توضیحات مدیر:</span>
                                                <span className="detail-value">{receipt.admin_notes}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* FIXED: Receipt preview with proper URLs */}
                                    <div className="receipt-preview">
                                        {receipt.file_type === 'image' ? (
                                            <img
                                                src={receipt.file_url}
                                                alt={`رسید پرداخت ${index + 1}`}
                                                className="receipt-image"
                                                onClick={() => handleImageClick([receipt], 0)}
                                                onError={(e) => {
                                                    console.error('❌ Image load error:', e.target.src);
                                                    e.target.src = '/placeholder-image.png'; // Add a placeholder
                                                    e.target.onerror = null; // Prevent infinite loop
                                                }}
                                            />
                                        ) : (
                                            <div className="pdf-preview">
                                                <p className="pdf-name">{receipt.file_name}</p>
                                                <NeoBrutalistButton
                                                    text=" مشاهده PDF"
                                                    color="blue-400"
                                                    textColor="white"
                                                    onClick={() => handleViewPDF(receipt)}
                                                    className="pdf-view-btn"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* FIXED: Receipt actions */}
                                <div className="receipt-actions">
                                    <NeoBrutalistButton
                                        text=" دانلود"
                                        color="green-400"
                                        textColor="black"
                                        onClick={() => handleDownloadReceipt(receipt)}
                                        className="download-receipt-btn"
                                    />
                                </div>
                            </NeoBrutalistCard>
                        ))}
                    </div>

                    {/* Gallery view for all images */}
                    {paymentReceipts.filter(r => r.file_type === 'image').length > 1 && (
                        <div className="gallery-section">
                            <NeoBrutalistButton
                                text=" مشاهده همه تصاویر در گالری"
                                color="purple-400"
                                textColor="white"
                                onClick={() => handleImageClick(paymentReceipts.filter(r => r.file_type === 'image'), 0)}
                                className="gallery-btn"
                            />
                        </div>
                    )}
                </div>
            ) : order.payment_receipt ? (
                // Legacy single payment receipt support
                <div className="payment-receipt-section">
                    <h3>رسید آپلود شده (قدیمی)</h3>
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
            ) : loadingReceipts ? (
                <div className="loading-receipts">
                    <span>🔄 در حال بارگیری رسیدهای پرداخت...</span>
                </div>
            ) : (
                <div className="no-receipts">
                    <span>هیچ رسید پرداختی یافت نشد</span>
                </div>
            )}

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
                        text={verifying ? "در حال تایید..." : " تایید پرداخت و تکمیل سفارش"}
                        color="green-400"
                        textColor="white"
                        onClick={() => handleVerifyPayment(true)}
                        disabled={verifying}
                        className="verify-btn"
                    />

                    <NeoBrutalistButton
                        text={verifying ? "در حال رد..." : " رد رسید پرداخت"}
                        color="red-400"
                        textColor="white"
                        onClick={() => handleVerifyPayment(false)}
                        disabled={verifying}
                        className="reject-btn"
                    />
                </div>
            </div>

            {/* FIXED: Image Gallery Modal with proper URLs */}
            {isImageModalOpen && (
                <div className="image-modal-overlay" onClick={() => setIsImageModalOpen(false)}>
                    <div className="image-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="image-modal-header">
                            <h3>گالری رسیدهای پرداخت</h3>
                            <button
                                className="image-modal-close"
                                onClick={() => setIsImageModalOpen(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="image-modal-content">
                            {selectedImages.length > 0 && (
                                <>
                                    <div className="main-image-container">
                                        <img
                                            src={selectedImages[currentImageIndex]?.file_url}
                                            alt={`رسید ${currentImageIndex + 1}`}
                                            className="main-modal-image"
                                            onError={(e) => {
                                                console.error('❌ Modal image load error:', e.target.src);
                                                e.target.style.display = 'none';
                                            }}
                                        />

                                        {selectedImages.length > 1 && (
                                            <>
                                                <button className="image-nav-btn prev-btn" onClick={prevImage}>
                                                    ‹
                                                </button>
                                                <button className="image-nav-btn next-btn" onClick={nextImage}>
                                                    ›
                                                </button>
                                                <div className="image-counter">
                                                    {currentImageIndex + 1} از {selectedImages.length}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Thumbnail Navigation */}
                                    {selectedImages.length > 1 && (
                                        <div className="thumbnail-navigation">
                                            {selectedImages.map((image, index) => (
                                                <div
                                                    key={index}
                                                    className={`thumbnail-nav ${index === currentImageIndex ? 'active' : ''}`}
                                                    onClick={() => setCurrentImageIndex(index)}
                                                >
                                                    <img
                                                        src={image.file_url}
                                                        alt={`Thumbnail ${index + 1}`}
                                                        className="thumbnail-nav-image"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Image Info */}
                                    <div className="image-info">
                                        <div className="image-detail">
                                            <strong>نام فایل:</strong> {selectedImages[currentImageIndex]?.file_name}
                                        </div>
                                        <div className="image-detail">
                                            <strong>تاریخ آپلود:</strong> {new Date(selectedImages[currentImageIndex]?.uploaded_at).toLocaleDateString('fa-IR')}
                                        </div>
                                        <div className="image-detail">
                                            <strong>حجم فایل:</strong> {formatFileSize(selectedImages[currentImageIndex]?.file_size)}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentVerificationComponent;