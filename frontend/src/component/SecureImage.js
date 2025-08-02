// frontend/src/component/SecureImage.js - QUICK FIX

import React, { useState, useEffect } from 'react';

const SecureImage = ({ receiptId, alt, className, onClick, style, onError }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadImage();

        // Cleanup function to revoke object URL
        return () => {
            if (imageUrl && imageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [receiptId]);

    const loadImage = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('access_token');
            if (!token) {
                throw new Error('No authentication token');
            }

            // FIXED: Construct URL more carefully to avoid double slashes
            const baseUrl = 'http://127.0.0.1:8000'; // Base URL without /api
            const fullUrl = `${baseUrl}/api/receipts/${receiptId}/view/`;

            console.log('🔍 Loading image from URL:', fullUrl); // Debug log

            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'image/*,application/pdf,*/*',
                },
                credentials: 'include'
            });

            console.log('📡 Response status:', response.status, response.statusText); // Debug log

            if (!response.ok) {
                throw new Error(`Failed to load image: ${response.status} ${response.statusText}`);
            }

            const blob = await response.blob();
            console.log('📦 Blob type:', blob.type, 'size:', blob.size); // Debug log

            const objectUrl = URL.createObjectURL(blob);
            setImageUrl(objectUrl);
        } catch (err) {
            console.error('❌ Error loading secure image:', err);
            setError(err.message);
            if (onError) {
                onError(err);
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={`secure-image-loading ${className || ''}`} style={style}>
                <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    background: '#f3f4f6',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    minHeight: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
                        <div>در حال بارگیری...</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`secure-image-error ${className || ''}`} style={style}>
                <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    background: '#fef2f2',
                    border: '2px solid #fecaca',
                    borderRadius: '8px',
                    color: '#dc2626',
                    minHeight: '100px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>❌</div>
                        <div>خطا در بارگیری تصویر</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>{error}</div>
                        <button
                            onClick={loadImage}
                            style={{
                                marginTop: '8px',
                                padding: '4px 8px',
                                background: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            تلاش مجدد
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <img
            src={imageUrl}
            alt={alt}
            className={className}
            onClick={onClick}
            style={style}
            onError={(e) => {
                console.error('❌ Image render error:', e);
                setError('خطا در نمایش تصویر');
                if (onError) {
                    onError(e);
                }
            }}
        />
    );
};

export default SecureImage;