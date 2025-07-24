// frontend/src/pages/NewArrivalsPage.js - Enhanced with multiple images and shipment focus
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import NeoBrutalistCard from '../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../component/NeoBrutalist/NeoBrutalistButton';
import '../styles/component/NewArrivalsPage.css';

const NewArrivalsPage = () => {
    const [shipmentAnnouncements, setShipmentAnnouncements] = useState([]);
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchShipmentAnnouncements();
        fetchFeaturedProducts();
    }, []);

    const fetchShipmentAnnouncements = async () => {
        try {
            console.log('🚢 Fetching shipment announcements...');
            const response = await API.get('/shipment-announcements/');
            console.log('✅ Shipment announcements fetched:', response.data);
            setShipmentAnnouncements(response.data);
        } catch (err) {
            console.error('❌ Error fetching shipment announcements:', err);
            setError('خطا در بارگیری اطلاعیه‌های محموله');
        }
    };

    const fetchFeaturedProducts = async () => {
        try {
            // Get recent products that might be featured
            const response = await API.get('/products/new-arrivals/');
            console.log('🆕 Featured products fetched:', response.data);
            setFeaturedProducts(response.data.slice(0, 6)); // Limit to 6 featured items
        } catch (err) {
            console.error('❌ Error fetching featured products:', err);
            // Don't set error for featured products - they're optional
        } finally {
            setLoading(false);
        }
    };

    const getDaysAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return 'دیروز';
        if (diffDays < 7) return `${diffDays} روز پیش`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} هفته پیش`;
        return 'بیش از یک ماه پیش';
    };

    const handleOrderInquiry = (productName) => {
        // Navigate to create order with inquiry about this product
        navigate('/orders/create', {
            state: {
                inquiryMode: true,
                productInquiry: productName
            }
        });
    };

    if (loading) {
        return (
            <div className="new-arrivals-page">
                <div className="page-header">
                    <h1>در حال بارگیری اطلاعیه‌های جدید...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="new-arrivals-page" dir="rtl">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="page-title">🚢 محموله‌های جدید</h1>
                        <p className="page-subtitle">
                            آخرین اطلاعیه‌ها و محموله‌های وارد شده
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="کاتالوگ محصولات"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/product')}
                            className="catalog-btn"
                        />
                        <NeoBrutalistButton
                            text="ثبت سفارش"
                            color="green-400"
                            textColor="black"
                            onClick={() => navigate('/orders/create')}
                            className="order-btn"
                        />
                        <NeoBrutalistButton
                            text="داشبورد"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => navigate('/dashboard')}
                            className="dashboard-btn"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <span>⚠️ {error}</span>
                </div>
            )}

            {/* Latest Shipment Announcements */}
            {shipmentAnnouncements.length > 0 && (
                <div className="shipments-section">
                    <h2 className="section-title">📢 آخرین محموله‌ها</h2>
                    <div className="shipments-grid">
                        {shipmentAnnouncements.map((announcement) => (
                            <NeoBrutalistCard
                                key={announcement.id}
                                className="shipment-card"
                                onClick={() => setSelectedAnnouncement(announcement)}
                            >
                                <div className="shipment-header">
                                    <h3 className="shipment-title">{announcement.title}</h3>
                                    <div className="shipment-meta">
                                        <span className="shipment-date">
                                            {getDaysAgo(announcement.created_at)}
                                        </span>
                                        <span className="shipment-type">
                                            {announcement.shipment_type || 'محموله عمومی'}
                                        </span>
                                    </div>
                                </div>

                                {/* Multiple Images Support */}
                                {announcement.images && announcement.images.length > 0 && (
                                    <div className="shipment-images">
                                        {announcement.images.length === 1 ? (
                                            <div className="single-image">
                                                <img
                                                    src={announcement.images[0].image}
                                                    alt={announcement.title}
                                                    className="shipment-image"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="multiple-images">
                                                <div className="main-image">
                                                    <img
                                                        src={announcement.images[0].image}
                                                        alt={announcement.title}
                                                        className="shipment-image"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                                <div className="thumbnail-grid">
                                                    {announcement.images.slice(1, 4).map((img, idx) => (
                                                        <div key={idx} className="thumbnail">
                                                            <img
                                                                src={img.image}
                                                                alt={`${announcement.title} ${idx + 2}`}
                                                                className="thumbnail-image"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                }}
                                                            />
                                                        </div>
                                                    ))}
                                                    {announcement.images.length > 4 && (
                                                        <div className="more-images">
                                                            <span>+{announcement.images.length - 4}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="shipment-content">
                                    <p className="shipment-description">
                                        {announcement.description}
                                    </p>

                                    {/* Shipment Details */}
                                    <div className="shipment-details">
                                        {announcement.origin && (
                                            <div className="detail-item">
                                                <span className="detail-label">🌍 مبدأ:</span>
                                                <span className="detail-value">{announcement.origin}</span>
                                            </div>
                                        )}
                                        {announcement.container_info && (
                                            <div className="detail-item">
                                                <span className="detail-label">📦 کانتینر:</span>
                                                <span className="detail-value">{announcement.container_info}</span>
                                            </div>
                                        )}
                                        {announcement.weight && (
                                            <div className="detail-item">
                                                <span className="detail-label">⚖️ وزن:</span>
                                                <span className="detail-value">{announcement.weight}</span>
                                            </div>
                                        )}
                                        {announcement.estimated_products_count && (
                                            <div className="detail-item">
                                                <span className="detail-label">📊 تعداد محصول:</span>
                                                <span className="detail-value">
                                                    {announcement.estimated_products_count} قلم
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Featured Products from this Shipment */}
                                    {announcement.featured_items && announcement.featured_items.length > 0 && (
                                        <div className="featured-items">
                                            <h4 className="featured-title">محصولات ویژه این محموله:</h4>
                                            <div className="featured-list">
                                                {announcement.featured_items.map((item, idx) => (
                                                    <div key={idx} className="featured-item">
                                                        <span className="item-name">{item.name}</span>
                                                        {item.special_note && (
                                                            <span className="item-note">{item.special_note}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="shipment-actions">
                                    <NeoBrutalistButton
                                        text="مشاهده جزئیات"
                                        color="blue-400"
                                        textColor="white"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAnnouncement(announcement);
                                        }}
                                        className="details-btn"
                                    />
                                    <NeoBrutalistButton
                                        text="استعلام قیمت"
                                        color="green-400"
                                        textColor="black"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOrderInquiry(announcement.title);
                                        }}
                                        className="inquiry-btn"
                                    />
                                </div>
                            </NeoBrutalistCard>
                        ))}
                    </div>
                </div>
            )}

            {/* Featured Products Section (No Stock Display) */}
            {featuredProducts.length > 0 && (
                <div className="featured-products-section">
                    <h2 className="section-title">⭐ محصولات ویژه</h2>
                    <div className="featured-products-grid">
                        {featuredProducts.map((product) => (
                            <NeoBrutalistCard key={product.id} className="featured-product-card">
                                <div className="product-image-container">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.name}
                                            className="product-image"
                                            onError={(e) => {
                                                e.target.src = '/placeholder-product.png';
                                            }}
                                        />
                                    ) : (
                                        <div className="product-image-placeholder">
                                            🥜
                                            <span>تصویر ندارد</span>
                                        </div>
                                    )}

                                    {/* New arrival badge - no stock status */}
                                    <div className="arrival-badge">
                                        جدید
                                    </div>
                                </div>

                                <div className="product-info">
                                    <h3 className="product-name">{product.name}</h3>
                                    <p className="product-description">
                                        {product.description.length > 80
                                            ? `${product.description.substring(0, 80)}...`
                                            : product.description
                                        }
                                    </p>

                                    <div className="product-actions">
                                        <NeoBrutalistButton
                                            text="مشاهده در کاتالوگ"
                                            color="blue-400"
                                            textColor="white"
                                            onClick={() => navigate('/product')}
                                            className="catalog-btn"
                                        />
                                        <NeoBrutalistButton
                                            text="استعلام قیمت"
                                            color="yellow-400"
                                            textColor="black"
                                            onClick={() => handleOrderInquiry(product.name)}
                                            className="inquiry-btn"
                                        />
                                    </div>
                                </div>
                            </NeoBrutalistCard>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {shipmentAnnouncements.length === 0 && featuredProducts.length === 0 && !loading && (
                <div className="empty-state">
                    <NeoBrutalistCard className="empty-card">
                        <div className="empty-content">
                            <div className="empty-icon">🚢</div>
                            <h3>در حال حاضر محموله جدیدی نداریم</h3>
                            <p>به محض ورود محموله‌های جدید، اطلاعیه‌ها در اینجا نمایش داده می‌شود.</p>

                            <div className="empty-actions">
                                <NeoBrutalistButton
                                    text="مشاهده کاتالوگ فعلی"
                                    color="blue-400"
                                    textColor="white"
                                    onClick={() => navigate('/product')}
                                    className="view-catalog-btn"
                                />
                                <NeoBrutalistButton
                                    text="ثبت درخواست ویژه"
                                    color="yellow-400"
                                    textColor="black"
                                    onClick={() => navigate('/orders/create')}
                                    className="special-request-btn"
                                />
                            </div>
                        </div>
                    </NeoBrutalistCard>
                </div>
            )}

            {/* Quick Actions */}
            <div className="quick-actions-section">
                <NeoBrutalistCard className="quick-actions-card">
                    <h3 className="actions-title">خدمات سریع</h3>
                    <div className="actions-grid">
                        <NeoBrutalistButton
                            text="📋 ثبت سفارش جدید"
                            color="green-400"
                            textColor="black"
                            onClick={() => navigate('/orders/create')}
                            className="quick-action-btn"
                        />

                        <NeoBrutalistButton
                            text="📦 کاتالوگ کامل"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/product')}
                            className="quick-action-btn"
                        />

                        <NeoBrutalistButton
                            text="📞 تماس برای استعلام"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => {
                                // Add phone contact functionality
                                window.open('tel:+989123456789', '_self');
                            }}
                            className="quick-action-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            </div>

            {/* Shipment Detail Modal */}
            {selectedAnnouncement && (
                <div className="modal-overlay" onClick={() => setSelectedAnnouncement(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{selectedAnnouncement.title}</h2>
                            <button
                                className="modal-close"
                                onClick={() => setSelectedAnnouncement(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Full image gallery would go here */}
                            <div className="full-description">
                                <p>{selectedAnnouncement.description}</p>
                            </div>

                            {/* Additional details */}
                            <div className="full-details">
                                {/* Complete shipment information */}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NewArrivalsPage;