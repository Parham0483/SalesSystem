import React, { useState, useRef } from 'react';

// Modal Component
const Modal = ({ isOpen, onClose, children, title }) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '1rem'
        }} onClick={onClose}>
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    border: '4px solid #000',
                    boxShadow: '8px 8px 0px #000',
                    maxWidth: '600px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    position: 'relative'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '3px solid #000',
                    backgroundColor: '#facc15',
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{
                        margin: 0,
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#000'
                    }}>
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: '3px solid #000',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Content */}
                <div style={{ padding: '1.5rem' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

// Enhanced PaymentReceiptUpload component with PDF support
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
            reader.readAsDataURL(file);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
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

            // Mock API call - replace with your actual API
            const response = await fetch(`/api/orders/${orderId}/upload-payment-receipt/`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'خطا در آپلود فایل');
            }

            // Success
            alert('رسید پرداخت با موفقیت آپلود شد!');

            // Clean up
            if (previewFile.type === 'pdf') {
                URL.revokeObjectURL(previewFile.preview);
            }

            setPreviewFile(null);
            setError('');

            if (onUploadSuccess) {
                onUploadSuccess();
            }

            if (onClose) {
                onClose();
            }

        } catch (err) {
            console.error('❌ Payment receipt upload failed:', err);
            setError(err.message || 'خطا در آپلود رسید پرداخت');
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

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="آپلود رسید پرداخت"
        >
            <div style={{ fontFamily: 'system-ui, sans-serif' }} dir="rtl">
                {error && (
                    <div style={{
                        background: '#fee2e2',
                        border: '3px solid #dc2626',
                        padding: '1rem',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '1rem',
                        color: '#dc2626',
                        fontWeight: 'bold'
                    }}>
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
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={openFileDialog}
                            style={{
                                border: `3px dashed ${isDragOver ? '#3b82f6' : '#6b7280'}`,
                                borderRadius: '12px',
                                padding: '2rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                background: isDragOver ? '#eff6ff' : '#f9fafb',
                                transform: isDragOver ? 'translateY(-2px)' : 'none'
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div style={{ fontSize: '3rem', opacity: 0.7 }}>
                                    📄
                                </div>
                                <div>
                                    {isDragOver ? (
                                        <p style={{ margin: '0.25rem 0', fontWeight: 'bold' }}>
                                            فایل را اینجا رها کنید...
                                        </p>
                                    ) : (
                                        <>
                                            <p style={{ margin: '0.25rem 0', fontWeight: 'bold' }}>
                                                فایل رسید پرداخت را اینجا بکشید
                                            </p>
                                            <p style={{ margin: '0.25rem 0', fontWeight: 'bold' }}>
                                                یا کلیک کنید تا فایل را انتخاب کنید
                                            </p>
                                        </>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    فرمت‌های مجاز: JPEG, PNG, GIF, WebP, PDF (حداکثر 15MB)
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{
                        border: '3px solid #374151',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        background: '#f9fafb'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem',
                            paddingBottom: '0.5rem',
                            borderBottom: '2px solid #e5e7eb'
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: '1.25rem',
                                fontWeight: 'bold'
                            }}>
                                پیش‌نمایش فایل
                            </h3>
                            <button
                                onClick={removePreview}
                                style={{
                                    background: '#ef4444',
                                    color: 'white',
                                    border: '2px solid #000',
                                    borderRadius: '50%',
                                    width: '2rem',
                                    height: '2rem',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 'bold'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{
                            display: 'flex',
                            gap: '1.5rem',
                            marginBottom: '1.5rem',
                            flexDirection: window.innerWidth < 768 ? 'column' : 'row'
                        }}>
                            {/* File Preview */}
                            <div style={{ flex: '1', maxWidth: '300px' }}>
                                {previewFile.type === 'image' ? (
                                    <img
                                        src={previewFile.preview}
                                        alt="پیش‌نمایش رسید پرداخت"
                                        style={{
                                            width: '100%',
                                            height: 'auto',
                                            maxHeight: '200px',
                                            objectFit: 'contain',
                                            border: '2px solid #d1d5db',
                                            borderRadius: '8px'
                                        }}
                                    />
                                ) : (
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '200px',
                                        border: '2px solid #d1d5db',
                                        borderRadius: '8px',
                                        backgroundColor: 'white'
                                    }}>
                                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
                                        <p style={{ margin: 0, fontWeight: 'bold', color: '#374151' }}>
                                            فایل PDF
                                        </p>
                                        <button
                                            onClick={() => window.open(previewFile.preview, '_blank')}
                                            style={{
                                                marginTop: '0.5rem',
                                                padding: '0.5rem 1rem',
                                                backgroundColor: '#3b82f6',
                                                color: 'white',
                                                border: '2px solid #000',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            مشاهده PDF
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* File Info */}
                            <div style={{
                                flex: '1',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                justifyContent: 'center'
                            }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <span style={{ fontWeight: 'bold', minWidth: '80px' }}>نام فایل:</span>
                                    <span style={{ color: '#374151', wordBreak: 'break-word' }}>
                                        {previewFile.name}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 'bold', minWidth: '80px' }}>حجم فایل:</span>
                                    <span style={{ color: '#374151' }}>
                                        {formatFileSize(previewFile.size)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 'bold', minWidth: '80px' }}>نوع فایل:</span>
                                    <span style={{ color: '#374151' }}>
                                        {previewFile.type === 'pdf' ? 'PDF' : 'تصویر'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Upload Actions */}
                        <div style={{
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <button
                                onClick={handleUpload}
                                disabled={uploading}
                                style={{
                                    minWidth: '200px',
                                    padding: '12px 24px',
                                    backgroundColor: uploading ? '#9ca3af' : '#4ade80',
                                    color: 'white',
                                    border: '3px solid #000',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    cursor: uploading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    transform: uploading ? 'none' : 'translateY(-2px)',
                                    boxShadow: uploading ? 'none' : '4px 4px 0px #000'
                                }}
                            >
                                {uploading ? "در حال آپلود..." : "آپلود رسید پرداخت"}
                            </button>

                            <button
                                onClick={onClose}
                                disabled={uploading}
                                style={{
                                    minWidth: '120px',
                                    padding: '12px 24px',
                                    backgroundColor: '#9ca3af',
                                    color: 'white',
                                    border: '3px solid #000',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    cursor: uploading ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    transform: uploading ? 'none' : 'translateY(-2px)',
                                    boxShadow: uploading ? 'none' : '4px 4px 0px #000'
                                }}
                            >
                                انصراف
                            </button>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    backgroundColor: '#dbeafe',
                    border: '2px solid #3b82f6',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    color: '#1e40af'
                }}>
                    <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        💡 راهنمایی:
                    </p>
                    <ul style={{ margin: 0, paddingRight: '1.5rem' }}>
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

// Demo Component
const PaymentUploadDemo = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);

    const handleUploadSuccess = () => {
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
    };

    return (
        <div style={{
            padding: '2rem',
            maxWidth: '600px',
            margin: '0 auto',
            textAlign: 'center'
        }}>
            <h2 style={{ marginBottom: '2rem' }}>
                نمونه آپلود رسید پرداخت
            </h2>

            {uploadSuccess && (
                <div style={{
                    background: '#dcfce7',
                    border: '3px solid #16a34a',
                    padding: '1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    color: '#16a34a',
                    fontWeight: 'bold'
                }}>
                    ✅ فایل با موفقیت آپلود شد!
                </div>
            )}

            <button
                onClick={() => setIsModalOpen(true)}
                style={{
                    padding: '12px 24px',
                    backgroundColor: '#facc15',
                    color: '#000',
                    border: '3px solid #000',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    transform: 'translateY(-2px)',
                    boxShadow: '4px 4px 0px #000'
                }}
                onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-4px)';
                    e.target.style.boxShadow = '6px 6px 0px #000';
                }}
                onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '4px 4px 0px #000';
                }}
            >
                📄 آپلود رسید پرداخت
            </button>

            <PaymentReceiptUploadModal
                orderId="123"
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onUploadSuccess={handleUploadSuccess}
            />
        </div>
    );
};

export default PaymentUploadDemo;