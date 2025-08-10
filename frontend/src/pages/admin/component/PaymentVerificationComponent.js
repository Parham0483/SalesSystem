import React, { useState, useEffect } from 'react';
import API from '../../../component/api';
import NeoBrutalistButton from "../../../component/NeoBrutalist/NeoBrutalistButton";
import NeoBrutalistCard from "../../../component/NeoBrutalist/NeoBrutalistCard";
import '../../../styles/component/AdminComponent/PaymentVerification.css';

// Default AuthenticatedImage Component (same as before)
const DefaultAuthenticatedImage = ({ receipt, onError, className = "" }) => {
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (receipt && receipt.file_type === 'image') {
            loadAuthenticatedImage();
        }
    }, [receipt]);

    const loadAuthenticatedImage = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('access_token');
            if (!token) {
                throw new Error('Authentication token not found');
            }

            const imageUrl = receipt.download_url;

            if (!imageUrl) {
                throw new Error('Download URL not available');
            }

            console.log('🔍 PaymentVerification loading image from download URL:', imageUrl);

            const response = await fetch(imageUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            setImageData(objectUrl);
            console.log('✅ PaymentVerification image loaded successfully');

        } catch (err) {
            console.error('❌ Error loading PaymentVerification authenticated image:', err);
            setError(err.message);
            if (onError) {
                onError(err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (imageData) {
                URL.revokeObjectURL(imageData);
            }
        };
    }, [imageData]);

    if (loading) {
        return (
            <div className={`verification-image-loading ${className}`} style={{
                textAlign: 'center',
                padding: '15px',
                border: '2px dashed #ccc',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9'
            }}>
                <div style={{ fontSize: '16px', marginBottom: '6px' }}>🔄</div>
                <span style={{ fontSize: '12px' }}>در حال بارگیری...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`verification-image-error ${className}`} style={{
                textAlign: 'center',
                padding: '15px',
                color: '#ef4444',
                border: '2px solid #ef4444',
                borderRadius: '8px',
                backgroundColor: '#fef2f2'
            }}>
                <div style={{ fontSize: '16px', marginBottom: '6px' }}>⚠️</div>
                <div style={{ marginBottom: '8px', fontSize: '12px' }}>خطا در بارگیری تصویر</div>
                <button
                    onClick={loadAuthenticatedImage}
                    style={{
                        padding: '4px 8px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                    }}
                >
                    تلاش مجدد
                </button>
            </div>
        );
    }

    if (!imageData) {
        return (
            <div className={`verification-image-placeholder ${className}`} style={{
                textAlign: 'center',
                padding: '15px',
                color: '#6b7280',
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#f9fafb'
            }}>
                <span style={{ fontSize: '12px' }}>تصویر در دسترس نیست</span>
            </div>
        );
    }

    return (
        <div className={`verification-image-container ${className}`}>
            <img
                src={imageData}
                alt={`رسید پرداخت ${receipt.file_name}`}
                className="receipt-image"
                onClick={() => window.open(imageData, '_blank')}
                style={{
                    width: '100%',
                    maxWidth: '100%',
                    maxHeight: '250px',
                    objectFit: 'contain',
                    cursor: 'pointer',
                    border: '2px solid #000',
                    borderRadius: '8px',
                    backgroundColor: '#fff'
                }}
                onLoad={() => console.log('✅ PaymentVerification image rendered successfully')}
                onError={(e) => {
                    console.error('❌ PaymentVerification image render error:', e);
                    setError('خطا در نمایش تصویر');
                }}
            />
        </div>
    );
};

const PaymentVerificationComponent = ({ order, onPaymentVerified, AuthenticatedImage }) => {
    const [verifying, setVerifying] = useState(false);
    const [paymentNotes, setPaymentNotes] = useState('');
    const [error, setError] = useState('');
    const [paymentReceipts, setPaymentReceipts] = useState([]);
    const [loadingReceipts, setLoadingReceipts] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [selectedImages, setSelectedImages] = useState([]);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

    // Use passed AuthenticatedImage component or fallback to default
    const ImageComponent = AuthenticatedImage || DefaultAuthenticatedImage;

    useEffect(() => {
        if (order && (order.status === 'payment_uploaded' || order.has_payment_receipts)) {
            fetchPaymentReceipts();
        }
    }, [order]);

    useEffect(() => {
        if (isImageModalOpen) {
            document.body.classList.add('modal-open');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.classList.remove('modal-open');
            document.body.style.overflow = 'unset';
        }

        // Cleanup on unmount
        return () => {
            document.body.classList.remove('modal-open');
            document.body.style.overflow = 'unset';
        };
    }, [isImageModalOpen]);

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

    const closeModal = () => {
        setIsImageModalOpen(false);
        setSelectedImages([]);
        setCurrentImageIndex(0);
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

    useEffect(() => {
        const handleKeyPress = (e) => {
            if (isImageModalOpen) {
                if (e.key === 'Escape') {
                    closeModal();
                } else if (e.key === 'ArrowRight') {
                    nextImage();
                } else if (e.key === 'ArrowLeft') {
                    prevImage();
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isImageModalOpen, selectedImages.length]);

    const handleViewPDF = async (receipt) => {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.write('در حال بارگیری PDF...');
        }

        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                alert('لطفاً دوباره وارد شوید');
                return;
            }

            const pdfUrl = receipt.download_url || receipt.file_url;

            const response = await fetch(pdfUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const pdfBlob = await response.blob();
            const previewUrl = window.URL.createObjectURL(pdfBlob);

            if (newWindow) {
                newWindow.location.href = previewUrl;
                setTimeout(() => {
                    URL.revokeObjectURL(previewUrl);
                }, 60000);
            } else {
                alert('Pop-up blocker may be preventing the PDF from opening. Please allow pop-ups for this site.');
                URL.revokeObjectURL(previewUrl);
            }

        } catch (error) {
            console.error('❌ Error fetching PDF for preview:', error);
            if (newWindow) {
                newWindow.close();
            }
            alert('خطا در مشاهده فایل PDF. لطفاً دوباره تلاش کنید.');
        }
    };

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

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = receipt.file_name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);

        } catch (error) {
            console.error('❌ Error downloading file:', error);
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
                                            {receipt.file_type === 'pdf' ? '📄 PDF' : '🖼️ تصویر'}
                                        </span>
                                        <span className="receipt-size">
                                            {formatFileSize(receipt.file_size)}
                                        </span>
                                        <span className={`receipt-status ${receipt.is_verified ? 'verified' : 'pending'}`}>
                                            {receipt.is_verified ? ' تایید شده' : ' در انتظار بررسی'}
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

                                    {/* Receipt preview */}
                                    <div className="receipt-preview">
                                        {receipt.file_type === 'image' ? (
                                            <ImageComponent
                                                receipt={receipt}
                                                onError={(err) => {
                                                    console.error(`Receipt ${receipt.id} image load error:`, err);
                                                }}
                                                className="verification-receipt-image"
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

                    {paymentReceipts.filter(r => r.file_type === 'image').length > 1 && (
                        <div className="gallery-section">
                            <NeoBrutalistButton
                                text="مشاهده همه تصاویر در گالری"
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
                                onError={(e) => {
                                    console.error('❌ Legacy receipt image load error:', e.target.src);
                                    e.target.style.display = 'none';
                                }}
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

            {order.status !== 'completed' && (
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
            )}

            {isImageModalOpen && (
                <div
                    className="image-modal-overlay"
                    onClick={closeModal}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999,
                        backdropFilter: 'blur(2px)'
                    }}
                >
                    <div
                        className="image-modal-container"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            width: '800px',
                            position: 'relative',
                            overflow: 'hidden',
                            border: '3px solid #000'
                        }}
                    >
                        <div className="image-modal-header" style={{
                            padding: '16px 20px',
                            borderBottom: '2px solid #000',
                            background: '#f9fafb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: '18px',
                                fontWeight: 'bold',
                                color: '#111827'
                            }}>گالری رسیدهای پرداخت</h3>
                            <button
                                className="image-modal-close"
                                onClick={closeModal}
                                style={{
                                    background: '#ef4444',
                                    border: '2px solid #000',
                                    color: 'white',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '4px',
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div className="image-modal-content" style={{
                            padding: '20px',
                            maxHeight: 'calc(90vh - 80px)',
                            overflowY: 'auto'
                        }}>
                            {selectedImages.length > 0 && (
                                <>
                                    <div className="main-image-container" style={{
                                        position: 'relative',
                                        background: '#f3f4f6',
                                        border: '2px solid #000',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        marginBottom: '20px'
                                    }}>
                                        <div style={{
                                            width: '100%',
                                            height: '500px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: 'white'
                                        }}>
                                            <ImageComponent
                                                receipt={selectedImages[currentImageIndex]}
                                                onError={(err) => {
                                                    console.error('Modal image load error:', err);
                                                }}
                                                className="main-modal-image"
                                            />
                                        </div>

                                        {selectedImages.length > 1 && (
                                            <>
                                                <button
                                                    className="image-nav-btn prev-btn"
                                                    onClick={prevImage}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        left: '10px',
                                                        transform: 'translateY(-50%)',
                                                        background: 'rgba(0, 0, 0, 0.7)',
                                                        color: 'white',
                                                        border: '2px solid #000',
                                                        width: '48px',
                                                        height: '48px',
                                                        borderRadius: '50%',
                                                        fontSize: '24px',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 10
                                                    }}
                                                >
                                                    ›
                                                </button>
                                                <button
                                                    className="image-nav-btn next-btn"
                                                    onClick={nextImage}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '50%',
                                                        right: '10px',
                                                        transform: 'translateY(-50%)',
                                                        background: 'rgba(0, 0, 0, 0.7)',
                                                        color: 'white',
                                                        border: '2px solid #000',
                                                        width: '48px',
                                                        height: '48px',
                                                        borderRadius: '50%',
                                                        fontSize: '24px',
                                                        fontWeight: 'bold',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        zIndex: 10
                                                    }}
                                                >
                                                    ‹
                                                </button>
                                                <div className="image-counter" style={{
                                                    position: 'absolute',
                                                    bottom: '10px',
                                                    left: '50%',
                                                    transform: 'translateX(-50%)',
                                                    background: 'rgba(0, 0, 0, 0.8)',
                                                    color: 'white',
                                                    padding: '6px 12px',
                                                    borderRadius: '20px',
                                                    border: '2px solid #000',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {currentImageIndex + 1} از {selectedImages.length}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Thumbnail Navigation */}
                                    {selectedImages.length > 1 && (
                                        <div className="thumbnail-navigation" style={{
                                            display: 'flex',
                                            gap: '8px',
                                            justifyContent: 'center',
                                            flexWrap: 'wrap',
                                            marginBottom: '20px',
                                            padding: '10px',
                                            background: '#f9fafb',
                                            border: '2px solid #000',
                                            borderRadius: '8px'
                                        }}>
                                            {selectedImages.map((image, index) => (
                                                <div
                                                    key={index}
                                                    className={`thumbnail-nav ${index === currentImageIndex ? 'active' : ''}`}
                                                    onClick={() => setCurrentImageIndex(index)}
                                                    style={{
                                                        width: '80px',
                                                        height: '80px',
                                                        border: index === currentImageIndex ? '3px solid #ef4444' : '2px solid #d1d5db',
                                                        borderRadius: '6px',
                                                        overflow: 'hidden',
                                                        cursor: 'pointer',
                                                        background: 'white',
                                                        transform: index === currentImageIndex ? 'scale(1.1)' : 'scale(1)'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <ImageComponent
                                                            receipt={image}
                                                            onError={() => {}}
                                                            className="thumbnail-nav-image"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Image Info */}
                                    <div className="image-info" style={{
                                        background: '#f9fafb',
                                        border: '2px solid #000',
                                        borderRadius: '8px',
                                        padding: '16px'
                                    }}>
                                        <div className="image-detail" style={{
                                            marginBottom: '8px',
                                            fontSize: '14px',
                                            color: '#374151'
                                        }}>
                                            <strong style={{ color: '#111827', marginLeft: '8px' }}>نام فایل:</strong>
                                            {selectedImages[currentImageIndex]?.file_name}
                                        </div>
                                        <div className="image-detail" style={{
                                            marginBottom: '8px',
                                            fontSize: '14px',
                                            color: '#374151'
                                        }}>
                                            <strong style={{ color: '#111827', marginLeft: '8px' }}>تاریخ آپلود:</strong>
                                            {new Date(selectedImages[currentImageIndex]?.uploaded_at).toLocaleDateString('fa-IR')}
                                        </div>
                                        <div className="image-detail" style={{
                                            fontSize: '14px',
                                            color: '#374151'
                                        }}>
                                            <strong style={{ color: '#111827', marginLeft: '8px' }}>حجم فایل:</strong>
                                            {formatFileSize(selectedImages[currentImageIndex]?.file_size)}
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