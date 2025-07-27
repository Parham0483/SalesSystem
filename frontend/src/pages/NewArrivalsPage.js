import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import { useCategories } from '../hooks/useCategories';
import NeoBrutalistCard from '../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistModal from '../component/NeoBrutalist/NeoBrutalistModal';
import '../styles/component/NewArrivalsPage.css';

const NewArrivalsPage = () => {
    const [shipmentAnnouncements, setShipmentAnnouncements] = useState([]);
    const [featuredProducts, setFeaturedProducts] = useState([]);
    const { categories } = useCategories();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        fetchShipmentAnnouncements();
        fetchFeaturedProducts();
    }, []);

    const fetchShipmentAnnouncements = async () => {
        try {
            const response = await API.get('/shipment-announcements/');
            setShipmentAnnouncements(response.data);
        } catch (err) {
            if (err.response?.status === 401) {
                setError('نشست شما منقضی شده است. در حال انتقال به صفحه ورود...');
                setTimeout(() => handleLogout(), 2000);
            } else {
                setError('خطا در بارگیری اطلاعیه‌های محموله');
            }
        }
    };

    const fetchFeaturedProducts = async () => {
        try {
            const response = await API.get('/products/new-arrivals/');
            setFeaturedProducts(response.data.slice(0, 6));
        } catch (err) {
            // Don't set error for featured products - they're optional
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
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

    const handleOrderInquiry = (productName, announcementTitle) => {
        navigate('/orders/create', {
            state: {
                inquiryMode: true,
                productInquiry: productName,
                announcementReference: announcementTitle
            }
        });
    };

    const openAnnouncementModal = (announcement) => {
        setSelectedAnnouncement(announcement);
        setCurrentImageIndex(0);
    };

    const nextImage = () => {
        if (selectedAnnouncement && selectedAnnouncement.images.length > 1) {
            setCurrentImageIndex((prev) =>
                prev === selectedAnnouncement.images.length - 1 ? 0 : prev + 1
            );
        }
    };

    const prevImage = () => {
        if (selectedAnnouncement && selectedAnnouncement.images.length > 1) {
            setCurrentImageIndex((prev) =>
                prev === 0 ? selectedAnnouncement.images.length - 1 : prev - 1
            );
        }
    };

    if (loading) {
        return (
            <div className="new-arrivals-page">
                <div className="page-header">
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <h1>در حال بارگیری اطلاعیه‌های جدید...</h1>
                    </div>
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
                            {shipmentAnnouncements.length > 0 && ` - ${shipmentAnnouncements.length} محموله`}
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="کاتالوگ"
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
                        <NeoBrutalistButton
                            text="خروج"
                            color="red-400"
                            textColor="white"
                            onClick={handleLogout}
                            className="logout-btn"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <span>⚠️ {error}</span>
                    <NeoBrutalistButton
                        text="تلاش مجدد"
                        color="blue-400"
                        textColor="white"
                        onClick={() => {
                            setError('');
                            fetchShipmentAnnouncements();
                            fetchFeaturedProducts();
                        }}
                        className="retry-btn"
                    />
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
                                className={`shipment-card ${announcement.is_featured ? 'featured' : ''}`}
                                onClick={() => openAnnouncementModal(announcement)}
                            >
                                <div className="shipment-header">
                                    <h3 className="shipment-title">{announcement.title}</h3>
                                    <div className="shipment-meta">
                                        <span className="shipment-date">
                                            {getDaysAgo(announcement.created_at)}
                                        </span>
                                        {announcement.is_featured && (
                                            <span className="featured-badge">ویژه</span>
                                        )}
                                        {announcement.created_by_name && (
                                            <span className="author-badge">
                                                توسط {announcement.created_by_name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Enhanced Image Display */}
                                <div className="shipment-images-container">
                                    {announcement.images && announcement.images.length > 0 ? (
                                        <div className="shipment-images">
                                            {announcement.images.length === 1 ? (
                                                <div className="single-image">
                                                    <img
                                                        src={announcement.images[0].image}
                                                        alt={announcement.title}
                                                        className="shipment-image main-image"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="multiple-images">
                                                    <div className="main-image-wrapper">
                                                        <img
                                                            src={announcement.images[0].image}
                                                            alt={announcement.title}
                                                            className="shipment-image main-image"
                                                        />
                                                        {announcement.images.length > 1 && (
                                                            <div className="image-count-badge">
                                                                {announcement.images.length} تصویر
                                                            </div>
                                                        )}
                                                    </div>
                                                    {announcement.images.length > 1 && (
                                                        <div className="thumbnail-preview">
                                                            {announcement.images.slice(1, 4).map((img, idx) => (
                                                                <div key={idx} className="thumbnail-item">
                                                                    <img
                                                                        src={img.image}
                                                                        alt={`${announcement.title} ${idx + 2}`}
                                                                        className="thumbnail-image"
                                                                    />
                                                                </div>
                                                            ))}
                                                            {announcement.images.length > 4 && (
                                                                <div className="more-images-indicator">
                                                                    +{announcement.images.length - 4}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="no-image-placeholder">
                                            <div className="placeholder-icon">📷</div>
                                            <span>تصویری موجود نیست</span>
                                        </div>
                                    )}
                                </div>

                                <div className="shipment-content">
                                    <p className="shipment-description">
                                        {announcement.description.length > 150
                                            ? `${announcement.description.substring(0, 150)}...`
                                            : announcement.description
                                        }
                                    </p>

                                    <div className="shipment-details">
                                        {announcement.origin_country && (
                                            <div className="detail-item">
                                                <span className="detail-label">🌍 مبدأ:</span>
                                                <span className="detail-value">{announcement.origin_country}</span>
                                            </div>
                                        )}
                                        {announcement.shipment_date && (
                                            <div className="detail-item">
                                                <span className="detail-label">📅 تاریخ ارسال:</span>
                                                <span className="detail-value">
                                                    {new Date(announcement.shipment_date).toLocaleDateString('fa-IR')}
                                                </span>
                                            </div>
                                        )}
                                        {announcement.estimated_arrival && (
                                            <div className="detail-item">
                                                <span className="detail-label">🚛 تاریخ رسیدن:</span>
                                                <span className="detail-value">
                                                    {new Date(announcement.estimated_arrival).toLocaleDateString('fa-IR')}
                                                </span>
                                            </div>
                                        )}
                                        {announcement.product_categories && (
                                            <div className="detail-item">
                                                <span className="detail-label">📦 دسته‌بندی:</span>
                                                <span className="detail-value">{announcement.product_categories}</span>
                                            </div>
                                        )}
                                        {announcement.products_count > 0 && (
                                            <div className="detail-item">
                                                <span className="detail-label">📊 تعداد محصول:</span>
                                                <span className="detail-value">
                                                    {announcement.products_count} قلم
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Related Products Preview */}
                                    {announcement.related_products_info && announcement.related_products_info.length > 0 && (
                                        <div className="related-products-preview">
                                            <h4 className="related-title">محصولات این محموله:</h4>
                                            <div className="related-list">
                                                {announcement.related_products_info.slice(0, 3).map((product, idx) => (
                                                    <div key={idx} className="related-item">
                                                        <span className="item-name">{product.name}</span>
                                                        {product.stock_status && (
                                                            <span className={`item-status ${product.stock_status}`}>
                                                                {product.stock_status === 'in_stock' ? 'موجود' :
                                                                    product.stock_status === 'out_of_stock' ? 'ناموجود' : 'نامشخص'}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                                {announcement.related_products_info.length > 3 && (
                                                    <div className="more-products">
                                                        و {announcement.related_products_info.length - 3} محصول دیگر...
                                                    </div>
                                                )}
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
                                            openAnnouncementModal(announcement);
                                        }}
                                        className="details-btn"
                                    />
                                    <NeoBrutalistButton
                                        text="استعلام قیمت"
                                        color="green-400"
                                        textColor="black"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOrderInquiry('محصولات محموله', announcement.title);
                                        }}
                                        className="inquiry-btn"
                                    />
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
                                window.open('tel:+989123456789', '_self');
                            }}
                            className="quick-action-btn"
                        />

                        <NeoBrutalistButton
                            text="📨 سفارشات من"
                            color="purple-400"
                            textColor="white"
                            onClick={() => navigate('/orders')}
                            className="quick-action-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            </div>

            {/* Enhanced Modal with Image Gallery */}
            <NeoBrutalistModal
                isOpen={!!selectedAnnouncement}
                onClose={() => setSelectedAnnouncement(null)}
                title={selectedAnnouncement ? selectedAnnouncement.title : ""}
                size="large"
            >
                {selectedAnnouncement && (
                    <div className="announcement-detail-modal" dir="rtl">
                        {/* Image Gallery */}
                        {selectedAnnouncement.images && selectedAnnouncement.images.length > 0 && (
                            <div className="modal-image-gallery">
                                <div className="main-image-container">
                                    <img
                                        src={selectedAnnouncement.images[currentImageIndex].image}
                                        alt={`${selectedAnnouncement.title} - تصویر ${currentImageIndex + 1}`}
                                        className="main-modal-image"
                                    />

                                    {selectedAnnouncement.images.length > 1 && (
                                        <>
                                            <button className="image-nav-btn prev-btn" onClick={prevImage}>
                                                ‹
                                            </button>
                                            <button className="image-nav-btn next-btn" onClick={nextImage}>
                                                ›
                                            </button>
                                            <div className="image-counter">
                                                {currentImageIndex + 1} از {selectedAnnouncement.images.length}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Thumbnail Navigation */}
                                {selectedAnnouncement.images.length > 1 && (
                                    <div className="thumbnail-navigation">
                                        {selectedAnnouncement.images.map((img, index) => (
                                            <div
                                                key={index}
                                                className={`thumbnail-nav ${index === currentImageIndex ? 'active' : ''}`}
                                                onClick={() => setCurrentImageIndex(index)}
                                            >
                                                <img
                                                    src={img.image}
                                                    alt={`Thumbnail ${index + 1}`}
                                                    className="thumbnail-nav-image"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Announcement Details */}
                        <div className="modal-announcement-info">
                            <div className="modal-header-info">
                                <h2 className="modal-announcement-title">{selectedAnnouncement.title}</h2>
                                <div className="modal-meta">
                                    <span className="modal-date">
                                        {getDaysAgo(selectedAnnouncement.created_at)}
                                    </span>
                                    {selectedAnnouncement.is_featured && (
                                        <span className="modal-featured-badge">ویژه</span>
                                    )}
                                </div>
                            </div>

                            <div className="modal-description">
                                <h4>توضیحات کامل:</h4>
                                <p>{selectedAnnouncement.description}</p>
                            </div>

                            {/* Complete Details */}
                            <div className="modal-complete-details">
                                {selectedAnnouncement.origin_country && (
                                    <div className="modal-detail-row">
                                        <span className="modal-detail-label">🌍 کشور مبدأ:</span>
                                        <span className="modal-detail-value">{selectedAnnouncement.origin_country}</span>
                                    </div>
                                )}

                                {selectedAnnouncement.shipment_date && (
                                    <div className="modal-detail-row">
                                        <span className="modal-detail-label">📅 تاریخ ارسال:</span>
                                        <span className="modal-detail-value">
                                            {new Date(selectedAnnouncement.shipment_date).toLocaleDateString('fa-IR')}
                                        </span>
                                    </div>
                                )}

                                {selectedAnnouncement.estimated_arrival && (
                                    <div className="modal-detail-row">
                                        <span className="modal-detail-label">🚛 تاریخ تخمینی رسیدن:</span>
                                        <span className="modal-detail-value">
                                            {new Date(selectedAnnouncement.estimated_arrival).toLocaleDateString('fa-IR')}
                                        </span>
                                    </div>
                                )}

                                {selectedAnnouncement.product_categories && (
                                    <div className="modal-detail-row">
                                        <span className="modal-detail-label">📦 دسته‌بندی محصولات:</span>
                                        <span className="modal-detail-value">{selectedAnnouncement.product_categories}</span>
                                    </div>
                                )}

                                <div className="modal-detail-row">
                                    <span className="modal-detail-label">📊 تعداد بازدید:</span>
                                    <span className="modal-detail-value">
                                        {selectedAnnouncement.view_count || 0} بار
                                    </span>
                                </div>

                                <div className="modal-detail-row">
                                    <span className="modal-detail-label">📅 تاریخ انتشار:</span>
                                    <span className="modal-detail-value">
                                        {new Date(selectedAnnouncement.created_at).toLocaleDateString('fa-IR')}
                                    </span>
                                </div>
                            </div>

                            {/* Related Products Full List */}
                            {selectedAnnouncement.related_products_info && selectedAnnouncement.related_products_info.length > 0 && (
                                <div className="modal-related-products">
                                    <h4>محصولات این محموله:</h4>
                                    <div className="modal-products-list">
                                        {selectedAnnouncement.related_products_info.map((product, idx) => (
                                            <div key={idx} className="modal-product-item">
                                                <div className="product-item-info">
                                                    <span className="product-item-name">{product.name}</span>
                                                    {product.stock_status && (
                                                        <span className={`product-item-status ${product.stock_status}`}>
                                                            {product.stock_status === 'in_stock' ? 'موجود' :
                                                                product.stock_status === 'out_of_stock' ? 'ناموجود' : 'نامشخص'}
                                                        </span>
                                                    )}
                                                </div>
                                                <NeoBrutalistButton
                                                    text="استعلام"
                                                    color="blue-400"
                                                    textColor="white"
                                                    onClick={() => {
                                                        setSelectedAnnouncement(null);
                                                        handleOrderInquiry(product.name, selectedAnnouncement.title);
                                                    }}
                                                    className="product-inquiry-btn"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </NeoBrutalistModal>
        </div>
    );
};

export default NewArrivalsPage;