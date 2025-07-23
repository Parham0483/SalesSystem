// frontend/src/pages/NewArrivalsPage.js - New Products Showcase
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import NeoBrutalistCard from '../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../component/NeoBrutalist/NeoBrutalistButton';
import '../styles/component/NewArrivalsPage.css';

const NewArrivalsPage = () => {
    const [newProducts, setNewProducts] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchNewArrivals();
        fetchAnnouncements();
    }, []);

    const fetchNewArrivals = async () => {
        try {
            // Get products from last 30 days
            const response = await API.get('/products/new-arrivals/');
            console.log('🆕 New arrivals fetched:', response.data);
            setNewProducts(response.data);
        } catch (err) {
            console.error('❌ Error fetching new arrivals:', err);
            // Fallback: get recent products from regular endpoint
            try {
                const response = await API.get('/products/');
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const recentProducts = response.data.filter(product =>
                    new Date(product.created_at) > thirtyDaysAgo
                ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                setNewProducts(recentProducts);
            } catch (fallbackErr) {
                setError('خطا در بارگیری محصولات جدید');
            }
        }
    };

    const fetchAnnouncements = async () => {
        try {
            const response = await API.get('/shipment-announcements/');
            console.log('📢 Announcements fetched:', response.data);
            setAnnouncements(response.data);
        } catch (err) {
            console.error('❌ Error fetching announcements:', err);
            // It's OK if announcements fail - we can show products without them
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

    const formatPrice = (price) => {
        if (!price || price === 0) return 'تماس بگیرید';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
    };

    const getStockStatus = (product) => {
        if (!product.is_active) {
            return { status: 'discontinued', text: 'متوقف شده', color: 'gray-400' };
        } else if (product.stock === 0) {
            return { status: 'out_of_stock', text: 'ناموجود', color: 'red-400' };
        } else if (product.stock <= 10) {
            return { status: 'low_stock', text: `${product.stock} عدد`, color: 'yellow-400' };
        } else {
            return { status: 'in_stock', text: 'موجود', color: 'green-400' };
        }
    };

    const handleOrderProduct = (product) => {
        navigate('/orders/create', {
            state: { preselectedProduct: product }
        });
    };

    if (loading) {
        return (
            <div className="new-arrivals-page">
                <div className="page-header">
                    <h1>در حال بارگیری محصولات جدید...</h1>
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
                        <h1 className="page-title">🆕 محصولات جدید</h1>
                        <p className="page-subtitle">
                            آخرین محصولات وارد شده به انبار
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="همه محصولات"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/products')}
                            className="all-products-btn"
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

            {/* Shipment Announcements */}
            {announcements.length > 0 && (
                <div className="announcements-section">
                    <h2 className="section-title">📢 اطلاعیه‌های جدید</h2>
                    <div className="announcements-grid">
                        {announcements.map((announcement) => (
                            <NeoBrutalistCard key={announcement.id} className="announcement-card">
                                <div className="announcement-header">
                                    <h3 className="announcement-title">{announcement.title}</h3>
                                    <span className="announcement-date">
                                        {getDaysAgo(announcement.created_at)}
                                    </span>
                                </div>

                                {announcement.image && (
                                    <div className="announcement-image">
                                        <img
                                            src={announcement.image}
                                            alt={announcement.title}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}

                                <div className="announcement-content">
                                    <p>{announcement.description}</p>
                                </div>

                                {announcement.products && announcement.products.length > 0 && (
                                    <div className="announcement-products">
                                        <p className="products-note">
                                            📦 {announcement.products.length} محصول جدید اضافه شد
                                        </p>
                                    </div>
                                )}
                            </NeoBrutalistCard>
                        ))}
                    </div>
                </div>
            )}

            {/* New Products Grid */}
            <div className="new-products-section">
                <h2 className="section-title">
                    🛍️ محصولات جدید ({newProducts.length} محصول)
                </h2>

                {newProducts.length > 0 ? (
                    <div className="products-grid">
                        {newProducts.map((product) => {
                            const stockStatus = getStockStatus(product);
                            const daysAgo = getDaysAgo(product.created_at);

                            return (
                                <NeoBrutalistCard key={product.id} className="product-card new-product">
                                    {/* New Badge */}
                                    <div className="new-badge">
                                        جدید
                                    </div>

                                    {/* Product Image */}
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
                                                📦
                                                <span>تصویر ندارد</span>
                                            </div>
                                        )}

                                        {/* Stock Status Badge */}
                                        <div className={`stock-badge ${stockStatus.status}`}>
                                            {stockStatus.text}
                                        </div>
                                    </div>

                                    {/* Product Info */}
                                    <div className="product-info">
                                        <div className="product-header">
                                            <h3 className="product-name">{product.name}</h3>
                                            <span className="product-date">{daysAgo}</span>
                                        </div>

                                        <p className="product-description">
                                            {product.description.length > 80
                                                ? `${product.description.substring(0, 80)}...`
                                                : product.description
                                            }
                                        </p>

                                        <div className="product-details">
                                            <div className="price-info">
                                                <span className="price-label">قیمت پایه:</span>
                                                <span className="price-value">
                                                    {formatPrice(product.base_price)}
                                                </span>
                                            </div>

                                            <div className="stock-info">
                                                <span className="stock-label">موجودی:</span>
                                                <span className={`stock-value ${stockStatus.status}`}>
                                                    {product.stock > 0 ? `${product.stock} عدد` : 'ناموجود'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="product-actions">
                                            <NeoBrutalistButton
                                                text="مشاهده در کاتالوگ"
                                                color="blue-400"
                                                textColor="white"
                                                onClick={() => navigate('/products')}
                                                className="catalog-btn"
                                            />

                                            {stockStatus.status !== 'discontinued' && (
                                                <NeoBrutalistButton
                                                    text={stockStatus.status === 'out_of_stock' ? 'درخواست سفارش' : 'سفارش دهید'}
                                                    color={stockStatus.status === 'out_of_stock' ? 'yellow-400' : 'green-400'}
                                                    textColor="black"
                                                    onClick={() => handleOrderProduct(product)}
                                                    className="order-btn"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </NeoBrutalistCard>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                        <NeoBrutalistCard className="empty-card">
                            <div className="empty-content">
                                <div className="empty-icon">📭</div>
                                <h3>محصول جدیدی یافت نشد</h3>
                                <p>در حال حاضر محصول جدیدی در ۳۰ روز گذشته اضافه نشده است.</p>

                                <div className="empty-actions">
                                    <NeoBrutalistButton
                                        text="مشاهده همه محصولات"
                                        color="blue-400"
                                        textColor="white"
                                        onClick={() => navigate('/products')}
                                        className="view-all-btn"
                                    />

                                    <NeoBrutalistButton
                                        text="ثبت سفارش جدید"
                                        color="yellow-400"
                                        textColor="black"
                                        onClick={() => navigate('/orders/create')}
                                        className="create-order-btn"
                                    />
                                </div>
                            </div>
                        </NeoBrutalistCard>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="quick-actions-section">
                <NeoBrutalistCard className="quick-actions-card">
                    <h3 className="actions-title">عملیات سریع</h3>
                    <div className="actions-grid">
                        <NeoBrutalistButton
                            text="📋 ثبت سفارش جدید"
                            color="green-400"
                            textColor="black"
                            onClick={() => navigate('/orders/create')}
                            className="quick-action-btn"
                        />

                        <NeoBrutalistButton
                            text="📦 مشاهده همه محصولات"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/products')}
                            className="quick-action-btn"
                        />

                        <NeoBrutalistButton
                            text="📊 سفارشات من"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => navigate('/dashboard')}
                            className="quick-action-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            </div>
        </div>
    );
};

export default NewArrivalsPage;