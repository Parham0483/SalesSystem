import React, { useState, useRef, useEffect } from 'react';
import '../styles/component/CustomerComponent/PaymentReceiptUpload.css'

// Enhanced Modal Component with better positioning
const Modal = ({ isOpen, onClose, children, title }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{title}</h2>
                    <button className="modal-close-btn" onClick={onClose}>✕</button>
                </div>
                <div className="modal-content">
                    {children}
                </div>
            </div>
        </div>
    );
};

const PaymentReceiptUploadModal = ({ orderId, onUploadSuccess, isOpen, onClose }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const validateFile = (file) => {
        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf'
        ];
        const maxSize = 15 * 1024 * 1024; // 15MB

        if (!allowedTypes.includes(file.type)) {
            return 'فقط فایل‌های تصویری (JPEG, PNG, GIF, WebP) و PDF مجاز هستند';
        }

        if (file.size > maxSize) {
            return 'حجم فایل نباید بیشتر از 15MB باشد';
        }

        if (file.size === 0) {
            return 'فایل خالی است';
        }

        return null;
    };

    const processFiles = (files) => {
        const maxFiles = 10;
        const fileArray = Array.from(files);

        if (fileArray.length > maxFiles) {
            setError(`حداکثر ${maxFiles} فایل در هر بار آپلود مجاز است`);
            return;
        }

        const validFiles = [];
        const errors = [];

        fileArray.forEach((file, index) => {
            const validationError = validateFile(file);
            if (validationError) {
                errors.push(`فایل ${index + 1} (${file.name}): ${validationError}`);
            } else {
                // Create preview for valid files
                const fileType = file.type.startsWith('image/') ? 'image' : 'pdf';

                if (fileType === 'image') {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const fileData = {
                            file: file,
                            id: Date.now() + index,
                            name: file.name,
                            size: file.size,
                            type: fileType,
                            preview: e.target.result
                        };
                        validFiles.push(fileData);

                        // Update state when all files are processed
                        if (validFiles.length === fileArray.filter(f => !validateFile(f)).length) {
                            setSelectedFiles(prev => [...prev, ...validFiles]);
                        }
                    };
                    reader.readAsDataURL(file);
                } else {
                    // For PDF files
                    const fileData = {
                        file: file,
                        id: Date.now() + index,
                        name: file.name,
                        size: file.size,
                        type: fileType,
                        preview: URL.createObjectURL(file)
                    };
                    validFiles.push(fileData);
                }
            }
        });

        if (errors.length > 0) {
            setError(errors.join('\n'));
        } else {
            setError('');
        }

        // Add PDF files immediately (they don't need FileReader)
        const pdfFiles = validFiles.filter(f => f.type === 'pdf');
        if (pdfFiles.length > 0) {
            setSelectedFiles(prev => [...prev, ...pdfFiles]);
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
        processFiles(e.dataTransfer.files);
    };

    const handleFileInputChange = (e) => {
        processFiles(e.target.files);
    };

    const removeFile = (fileId) => {
        setSelectedFiles(prev => {
            const updated = prev.filter(f => f.id !== fileId);
            // Clean up object URLs for removed files
            const removedFile = prev.find(f => f.id === fileId);
            if (removedFile && removedFile.type === 'pdf') {
                URL.revokeObjectURL(removedFile.preview);
            }
            return updated;
        });
    };

    const clearAllFiles = () => {
        // Clean up object URLs
        selectedFiles.forEach(file => {
            if (file.type === 'pdf') {
                URL.revokeObjectURL(file.preview);
            }
        });
        setSelectedFiles([]);
        setError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            setError('لطفاً حداقل یک فایل انتخاب کنید');
            return;
        }

        setUploading(true);
        setError('');

        try {
            const formData = new FormData();

            // Add all selected files to FormData
            selectedFiles.forEach(fileData => {
                formData.append('payment_receipts', fileData.file);
            });

            const token = localStorage.getItem('access_token');
            if (!token) {
                throw new Error('لطفاً دوباره وارد شوید');
            }

            console.log('📤 Uploading', selectedFiles.length, 'payment receipts for order:', orderId);
            const API_URL = process.env.REACT_APP_API_URL || '/api';
            const uploadUrl = `${API_URL}orders/${orderId}/upload-payment-receipt/`;

            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            let responseData = null;
            try {
                const responseText = await response.text();
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
                let errorMessage ='خطا در آپلود فایل‌ها';

                if (response.status === 413) {
                    errorMessage = 'مجموع حجم فایل‌ها بیش از حد مجاز است';
                } else if (response.status === 400) {
                    errorMessage = responseData?.error || 'فرمت فایل‌ها نامعتبر است';
                    if (responseData?.details) {
                        errorMessage += '\n' + responseData.details.join('\n');
                    }
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
            console.log('✅ Payment receipts uploaded successfully:', responseData);

            // Show success message
            const uploadedCount = responseData.uploaded_receipts?.length || selectedFiles.length;
            alert(`${uploadedCount} رسید پرداخت با موفقیت آپلود شد!`);

            // Show warnings if any
            if (responseData.warnings && responseData.warnings.length > 0) {
                console.warn('⚠️ Upload warnings:', responseData.warnings);
            }

            // Clean up
            clearAllFiles();

            // Call success callback
            if (onUploadSuccess) {
                onUploadSuccess(responseData);
            }

            // Close modal
            if (onClose) {
                onClose();
            }

        } catch (err) {
            console.error('❌ Payment receipts upload failed:', err);

            let errorMessage = 'خطا در آپلود رسیدهای پرداخت';

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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            selectedFiles.forEach(file => {
                if (file.type === 'pdf') {
                    URL.revokeObjectURL(file.preview);
                }
            });
        };
    }, []);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen && selectedFiles.length > 0) {
            clearAllFiles();
        }
    }, [isOpen]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="آپلود رسیدهای پرداخت"
        >
            <div className="payment-receipt-upload" dir="rtl">
                {error && (
                    <div className="upload-error">
                        <span>⚠️</span>
                        <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
                    </div>
                )}

                {selectedFiles.length === 0 ? (
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileInputChange}
                            style={{ display: 'none' }}
                            multiple // IMPORTANT: Enable multiple file selection
                        />

                        <div
                            className={`dropzone ${isDragOver ? 'dropzone-active' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={openFileDialog}
                        >
                            <div className="dropzone-content">
                                <div className="dropzone-text">
                                    {isDragOver ? (
                                        <p>فایل‌ها را اینجا رها کنید...</p>
                                    ) : (
                                        <>
                                            <p>فایل‌های رسید پرداخت را اینجا بکشید</p>
                                            <p>یا کلیک کنید تا فایل‌ها را انتخاب کنید</p>
                                            <p className="multiple-files-hint">
                                                🔢 می‌توانید چندین فایل انتخاب کنید (حداکثر 10 فایل)
                                            </p>
                                        </>
                                    )}
                                </div>
                                <div className="dropzone-hint">
                                    فرمت‌های مجاز: JPEG, PNG, GIF, WebP, PDF (حداکثر 15MB هر فایل)
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="files-container">
                        <div className="files-header">
                            <h3>فایل‌های انتخاب شده ({selectedFiles.length})</h3>
                            <div className="files-actions">
                                <button className="add-more-btn" onClick={openFileDialog}>
                                     افزودن فایل‌های بیشتر
                                </button>
                                <button className="clear-all-btn" onClick={clearAllFiles}>
                                     حذف همه
                                </button>
                            </div>
                        </div>

                        <div className="files-list">
                            {selectedFiles.map((fileData) => (
                                <div key={fileData.id} className="file-item">
                                    <div className="file-preview">
                                        {fileData.type === 'image' ? (
                                            <img
                                                src={fileData.preview}
                                                alt={fileData.name}
                                                className="file-preview-image"
                                            />
                                        ) : (
                                            <div className="pdf-preview">
                                                <p className="pdf-label">PDF</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="file-info">
                                        <div className="file-name" title={fileData.name}>
                                            {fileData.name.length > 25
                                                ? `${fileData.name.substring(0, 25)}...`
                                                : fileData.name
                                            }
                                        </div>
                                        <div className="file-details">
                                            <span className="file-size">{formatFileSize(fileData.size)}</span>
                                            <span className="file-type-badge">
                                                {fileData.type === 'pdf' ? 'PDF' : 'تصویر'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="file-actions">
                                        {fileData.type === 'pdf' && (
                                            <button
                                                className="preview-btn"
                                                onClick={() => window.open(fileData.preview, '_blank')}
                                            >
                                                مشاهده
                                            </button>
                                        )}
                                        <button
                                            className="remove-file-btn"
                                            onClick={() => removeFile(fileData.id)}
                                        >
                                             حذف
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Hidden input for adding more files */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleFileInputChange}
                            style={{ display: 'none' }}
                            multiple
                        />

                        {/* Upload Actions */}
                        <div className="upload-actions">
                            <button
                                className={`upload-btn ${uploading ? 'uploading' : ''}`}
                                onClick={handleUpload}
                                disabled={uploading}
                            >
                                {uploading
                                    ? `در حال آپلود ${selectedFiles.length} فایل...`
                                    : `آپلود ${selectedFiles.length} رسید پرداخت`
                                }
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
                        <li>می‌توانید چندین تصویر از رسید پرداخت یا چک آپلود کنید</li>
                        <li>فایل‌های PDF نیز پشتیبانی می‌شوند</li>
                        <li>حداکثر 10 فایل در هر بار آپلود</li>
                        <li>حداکثر حجم هر فایل: 15 مگابایت</li>
                        <li>فرمت‌های مجاز: JPEG, PNG, GIF, WebP, PDF</li>
                        <li>پس از آپلود، مدیر فایل‌ها را بررسی و تایید خواهد کرد</li>
                    </ul>
                </div>
            </div>
        </Modal>
    );
};

export default PaymentReceiptUploadModal;