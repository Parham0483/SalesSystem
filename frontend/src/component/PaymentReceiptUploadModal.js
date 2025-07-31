import React, { useState, useRef, useEffect } from 'react';
import '../styles/component/CustomerComponent/PaymentReceiptUpload.css'

// Enhanced Modal Component with better positioning
const Modal = ({ isOpen, onClose, children, title }) => {
    useEffect(() => {
        if (isOpen) {
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="modal-close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Modal Content */}
                <div className="modal-content">
                    {children}
                </div>
            </div>
        </div>
    );
};

// FIXED Payment Receipt Upload Component
const PaymentReceiptUploadModal = ({ orderId, onUploadSuccess, isOpen, onClose }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [previewFile, setPreviewFile] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const validateFile = (file) => {
        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf'
        ];
        const maxSize = 15 * 1024 * 1024; // 15MB for PDFs

        if (!allowedTypes.includes(file.type)) {
            return 'فقط فایل‌های تصویری (JPEG, PNG, GIF, WebP) و PDF مجاز هستند';
        }

        if (file.size > maxSize) {
            return 'حجم فایل نباید بیشتر از 15MB باشد';
        }

        return null;
    };

    const handleFileSelect = (file) => {
        setError('');

        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            return;
        }

        // Handle different file types
        if (file.type === 'application/pdf') {
            // For PDF files, create URL for preview
            const fileURL = URL.createObjectURL(file);
            setPreviewFile({
                file: file,
                preview: fileURL,
                name: file.name,
                size: file.size,
                type: 'pdf'
            });
        } else {
            // For image files, create data URL
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewFile({
                    file: file,
                    preview: e.target.result,
                    name: file.name,
                    size: file.size,
                    type: 'image'
                });
            };
            reader.onerror = () => {
                setError('خطا در خواندن فایل');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    };

    const handleFileInputChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    };

    const handleUpload = async () => {
        if (!previewFile) {
            setError('لطفاً ابتدا فایل را انتخاب کنید');
            return;
        }

        setUploading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('payment_receipt', previewFile.file);

            // FIXED: Better error handling for the API call
            const token = localStorage.getItem('access_token');
            if (!token) {
                throw new Error('لطفاً دوباره وارد شوید');
            }

            console.log('📤 Uploading payment receipt for order:', orderId);
            const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api';
            const uploadUrl = `${API_URL}orders/${orderId}/upload-payment-receipt/`;

            console.log('📤 Uploading payment receipt to:', uploadUrl);

            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });


            let responseData = null;

            // FIXED: Better response handling
            try {
                const responseText = await response.text();
                console.log('📄 Raw response:', responseText);

                if (responseText) {
                    responseData = JSON.parse(responseText);
                }
            } catch (jsonError) {
                console.error('❌ JSON parsing error:', jsonError);
                if (!response.ok) {
                    throw new Error(`خطای سرور (${response.status}): پاسخ نامعتبر`);
                }
            }

            if (!response.ok) {
                // Handle different types of error responses
                let errorMessage = 'خطا در آپلود فایل';

                if (response.status === 413) {
                    errorMessage = 'حجم فایل بیش از حد مجاز است';
                } else if (response.status === 400) {
                    errorMessage = responseData?.error || 'فرمت فایل نامعتبر است';
                } else if (response.status === 401) {
                    errorMessage = 'لطفاً دوباره وارد شوید';
                } else if (response.status === 403) {
                    errorMessage = 'شما مجاز به انجام این عمل نیستید';
                } else if (response.status === 404) {
                    errorMessage = 'سفارش پیدا نشد';
                } else if (responseData?.error) {
                    errorMessage = responseData.error;
                } else {
                    errorMessage = `خطای سرور (${response.status})`;
                }

                throw new Error(errorMessage);
            }

            // Success
            console.log('✅ Payment receipt uploaded successfully:', responseData);

            // Show success message
            alert('رسید پرداخت با موفقیت آپلود شد!');

            // Clean up
            if (previewFile.type === 'pdf') {
                URL.revokeObjectURL(previewFile.preview);
            }

            setPreviewFile(null);
            setError('');

            // Call success callback
            if (onUploadSuccess) {
                onUploadSuccess(responseData);
            }

            // Close modal
            if (onClose) {
                onClose();
            }

        } catch (err) {
            console.error('❌ Payment receipt upload failed:', err);

            // User-friendly error messages
            let errorMessage = 'خطا در آپلود رسید پرداخت';

            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                errorMessage = 'خطا در اتصال به سرور. لطفاً اتصال اینترنت خود را بررسی کنید.';
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
        } finally {
            setUploading(false);
        }
    };

    const removePreview = () => {
        if (previewFile?.type === 'pdf') {
            URL.revokeObjectURL(previewFile.preview);
        }
        setPreviewFile(null);
        setError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const openFileDialog = () => {
        fileInputRef.current?.click();
    };

    // FIXED: Cleanup on unmount
    useEffect(() => {
        return () => {
            if (previewFile?.type === 'pdf') {
                URL.revokeObjectURL(previewFile.preview);
            }
        };
    }, [previewFile]);

    // FIXED: Reset state when modal closes
    useEffect(() => {
        if (!isOpen && previewFile) {
            removePreview();
        }
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="آپلود رسید پرداخت"
        >
            <div className="payment-receipt-upload" dir="rtl">
                {error && (
                    <div className="upload-error">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                {!previewFile ? (
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileInputChange}
                            style={{ display: 'none' }}
                        />

                        <div
                            className={`dropzone ${isDragOver ? 'dropzone-active' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={openFileDialog}
                        >
                            <div className="dropzone-content">
                                <div className="dropzone-icon">📄</div>
                                <div className="dropzone-text">
                                    {isDragOver ? (
                                        <p>فایل را اینجا رها کنید...</p>
                                    ) : (
                                        <>
                                            <p>فایل رسید پرداخت را اینجا بکشید</p>
                                            <p>یا کلیک کنید تا فایل را انتخاب کنید</p>
                                        </>
                                    )}
                                </div>
                                <div className="dropzone-hint">
                                    فرمت‌های مجاز: JPEG, PNG, GIF, WebP, PDF (حداکثر 15MB)
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="preview-container">
                        <div className="preview-header">
                            <h3>پیش‌نمایش فایل</h3>
                            <button className="remove-preview-btn" onClick={removePreview}>
                                ✕
                            </button>
                        </div>

                        <div className="preview-content">
                            {/* File Preview */}
                            <div className="preview-image-container">
                                {previewFile.type === 'image' ? (
                                    <img
                                        src={previewFile.preview}
                                        alt="پیش‌نمایش رسید پرداخت"
                                        className="preview-image"
                                    />
                                ) : (
                                    <div className="pdf-preview">
                                        <div className="pdf-icon">📄</div>
                                        <p className="pdf-label">فایل PDF</p>
                                        <button
                                            className="pdf-view-btn"
                                            onClick={() => window.open(previewFile.preview, '_blank')}
                                        >
                                            مشاهده PDF
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* File Info */}
                            <div className="file-info">
                                <div className="file-info-item">
                                    <span className="file-info-label">نام فایل:</span>
                                    <span className="file-info-value">{previewFile.name}</span>
                                </div>
                                <div className="file-info-item">
                                    <span className="file-info-label">حجم فایل:</span>
                                    <span className="file-info-value">{formatFileSize(previewFile.size)}</span>
                                </div>
                                <div className="file-info-item">
                                    <span className="file-info-label">نوع فایل:</span>
                                    <span className="file-info-value">
                                        {previewFile.type === 'pdf' ? 'PDF' : 'تصویر'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Upload Actions */}
                        <div className="upload-actions">
                            <button
                                className={`upload-btn ${uploading ? 'uploading' : ''}`}
                                onClick={handleUpload}
                                disabled={uploading}
                            >
                                {uploading ? "در حال آپلود..." : "آپلود رسید پرداخت"}
                            </button>

                            <button
                                className="cancel-btn"
                                onClick={onClose}
                                disabled={uploading}
                            >
                                انصراف
                            </button>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="upload-instructions">
                    <p className="instructions-title">💡 راهنمایی:</p>
                    <ul className="instructions-list">
                        <li>تصویر واضح از رسید پرداخت یا چک آپلود کنید</li>
                        <li>می‌توانید فایل PDF نیز آپلود کنید</li>
                        <li>حداکثر حجم فایل: 15 مگابایت</li>
                        <li>پس از آپلود، مدیر رسید را بررسی و تایید خواهد کرد</li>
                    </ul>
                </div>
            </div>
        </Modal>
    );
};

// Export the component
export default PaymentReceiptUploadModal;