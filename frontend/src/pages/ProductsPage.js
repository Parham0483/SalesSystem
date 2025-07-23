// frontend/src/pages/ProductsPage.js - Customer Product Gallery
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import NeoBrutalistCard from '../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from '../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistModal from '../component/NeoBrutalist/NeoBrutalistModal';
import '../styles/component/ProductsPage.css';

const ProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'in_stock', 'out_of_stock'
    const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'price_low', 'price_high', 'name'
    const navigate = useNavigate();

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        filterAndSortProducts();
    }, [products, searchTerm, filterStatus, sortBy]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await API.get('/products/');
            console.log('📦 Products fetched:', response.data);
            setProducts(response.data);
            setError('');
        } catch (err) {
            console.error('❌ Error fetching products:', err);
            setError('خطا در بارگیری محصولات');
        } finally {
            setLoading(false);
        }
    };

    const filterAndSortProducts = () => {
        let filtered = [...products];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply stock status filter
        if (filterStatus !== 'all') {
            filtered = filtered.filter(product => {
                if (filterStatus === 'in_stock') {
                    return product.stock > 0 && product.is_active;
                } else if (filterStatus === 'out_of_stock') {
                    return product.stock === 0 || !product.is_active;
                }
                return true;
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'oldest':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'price_low':
                    return parseFloat(a.base_price) - parseFloat(b.base_price);
                case 'price_high':
                    return parseFloat(b.base_price) - parseFloat(a.base_price);
                case 'name':
                    return a.name.localeCompare(b.name);
                default:
                    return 0;
            }
        });

        setFilteredProducts(filtered);
    };

    const getStockStatus = (product) => {
        if (!product.is_active) {
            return { status: 'discontinued', text: 'متوقف شده', color: 'gray-400' };
        } else if (product.stock === 0) {
            return { status: 'out_of_stock', text: 'ناموجود', color: 'red-400' };
        } else if (product.stock <= 10) {
            return { status: 'low_stock', text: `${product.stock} عدد باقی‌مانده`, color: 'yellow-400' };
        } else {
            return { status: 'in_stock', text: 'موجود', color: 'green-400' };
        }
    };

    const handleProductClick = (product) => {
        setSelectedProduct(product);
    };

    const handleCreateOrder = (product) => {
        navigate('/orders/create', {
            state: { preselectedProduct: product }
        });
    };

    const formatPrice = (price) => {
        if (!price || price === 0) return 'تماس بگیرید';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
    };

    const getUserInfo = () => {
        const userDataString = localStorage.getItem('userData');
        return userDataString ? JSON.parse(userDataString) : null;
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    const isNewProduct = (createdAt) => {
        const productDate = new Date(createdAt);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return productDate > oneWeekAgo;
    };

    if (loading) {
        return (
            <div className="products-page">
                <div className="products-header">
                    <h1>در حال بارگیری محصولات...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="products-page" dir="rtl">
            {/* Header */}
            <div className="products-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="products-title">کاتالوگ محصولات</h1>
                        <p className="products-subtitle">
                            {filteredProducts.length} محصول یافت شد
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="ثبت سفارش"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => navigate('/orders/create')}
                            className="create-order-btn"
                        />
                        <NeoBrutalistButton
                            text="داشبورد"
                            color="blue-400"
                            textColor="white"
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
                        onClick={fetchProducts}
                        className="retry-btn"
                    />
                </div>
            )}

            {/* Filters and Search */}
            <div className="products-filters">
                <div className="search-section">
                    <NeoBrutalistInput
                        type="text"
                        placeholder="جستجو در محصولات..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-section">
                    <div className="filter-group">
                        <label>وضعیت موجودی:</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">همه محصولات</option>
                            <option value="in_stock">موجود</option>
                            <option value="out_of_stock">ناموجود</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>مرتب‌سازی:</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="filter-select"
                        >
                            <option value="newest">جدیدترین</option>
                            <option value="oldest">قدیمی‌ترین</option>
                            <option value="name">نام محصول</option>
                            <option value="price_low">قیمت (کم به زیاد)</option>
                            <option value="price_high">قیمت (زیاد به کم)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Products Grid */}
            <div className="products-grid">
                {filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product);
                    const isNew = isNewProduct(product.created_at);

                    return (
                        <NeoBrutalistCard
                            key={product.id}
                            className="product-card"
                            onClick={() => handleProductClick(product)}
                        >
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

                                {/* New Badge */}
                                {isNew && (
                                    <div className="new-badge">
                                        جدید
                                    </div>
                                )}

                                {/* Stock Status Badge */}
                                <div className={`stock-badge ${stockStatus.status}`}>
                                    {stockStatus.text}
                                </div>
                            </div>

                            {/* Product Info */}
                            <div className="product-info">
                                <h3 className="product-name">{product.name}</h3>
                                <p className="product-description">
                                    {product.description.length > 100
                                        ? `${product.description.substring(0, 100)}...`
                                        : product.description
                                    }
                                </p>

                                <div className="product-details">
                                    <div className="product-price">
                                        <span className="price-label">قیمت پایه:</span>
                                        <span className="price-value">
                                            {formatPrice(product.base_price)}
                                        </span>
                                    </div>

                                    <div className="product-stock">
                                        <span className="stock-label">موجودی:</span>
                                        <span className={`stock-value ${stockStatus.status}`}>
                                            {product.stock > 0 ? `${product.stock} عدد` : 'ناموجود'}
                                        </span>
                                    </div>
                                </div>

                                <div className="product-actions">
                                    <NeoBrutalistButton
                                        text="مشاهده جزئیات"
                                        color="blue-400"
                                        textColor="white"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleProductClick(product);
                                        }}
                                        className="details-btn"
                                    />

                                    {stockStatus.status !== 'discontinued' && (
                                        <NeoBrutalistButton
                                            text={stockStatus.status === 'out_of_stock' ? 'درخواست سفارش' : 'سفارش دهید'}
                                            color={stockStatus.status === 'out_of_stock' ? 'yellow-400' : 'green-400'}
                                            textColor="black"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCreateOrder(product);
                                            }}
                                            className="order-btn"
                                        />
                                    )}
                                </div>
                            </div>
                        </NeoBrutalistCard>
                    );
                })}
            </div>

            {/* Empty State */}
            {filteredProducts.length === 0 && !loading && (
                <div className="empty-state">
                    <NeoBrutalistCard className="empty-card">
                        <div className="empty-content">
                            <div className="empty-icon">📦</div>
                            <h3>محصولی یافت نشد</h3>
                            <p>
                                {searchTerm
                                    ? `هیچ محصولی با عبارت "${searchTerm}" یافت نشد.`
                                    : 'در حال حاضر محصولی در این دسته‌بندی موجود نیست.'
                                }
                            </p>
                            {searchTerm && (
                                <NeoBrutalistButton
                                    text="پاک کردن جستجو"
                                    color="blue-400"
                                    textColor="white"
                                    onClick={() => setSearchTerm('')}
                                    className="clear-search-btn"
                                />
                            )}
                        </div>
                    </NeoBrutalistCard>
                </div>
            )}

            {/* Product Detail Modal */}
            <NeoBrutalistModal
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                title={selectedProduct ? `جزئیات ${selectedProduct.name}` : ""}
                size="large"
            >
                {selectedProduct && (
                    <div className="product-detail-modal" dir="rtl">
                        <div className="modal-product-image">
                            {selectedProduct.image_url ? (
                                <img
                                    src={selectedProduct.image_url}
                                    alt={selectedProduct.name}
                                    className="modal-image"
                                    onError={(e) => {
                                        e.target.src = '/placeholder-product.png';
                                    }}
                                />
                            ) : (
                                <div className="modal-image-placeholder">
                                    📦
                                    <span>تصویر موجود نیست</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-product-info">
                            <h2 className="modal-product-name">{selectedProduct.name}</h2>

                            <div className="modal-stock-status">
                                <NeoBrutalistButton
                                    text={getStockStatus(selectedProduct).text}
                                    color={getStockStatus(selectedProduct).color}
                                    textColor="black"
                                    className="modal-status-badge"
                                />
                            </div>

                            <div className="modal-product-description">
                                <h4>توضیحات محصول:</h4>
                                <p>{selectedProduct.description}</p>
                            </div>

                            <div className="modal-product-details">
                                <div className="detail-row">
                                    <span className="detail-label">قیمت پایه:</span>
                                    <span className="detail-value">
                                        {formatPrice(selectedProduct.base_price)}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">موجودی:</span>
                                    <span className="detail-value">
                                        {selectedProduct.stock > 0 ? `${selectedProduct.stock} عدد` : 'ناموجود'}
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">تاریخ افزودن:</span>
                                    <span className="detail-value">
                                        {new Date(selectedProduct.created_at).toLocaleDateString('fa-IR')}
                                    </span>
                                </div>
                            </div>

                            <div className="modal-actions">
                                {getStockStatus(selectedProduct).status !== 'discontinued' && (
                                    <NeoBrutalistButton
                                        text={getStockStatus(selectedProduct).status === 'out_of_stock'
                                            ? 'درخواست سفارش'
                                            : 'سفارش این محصول'
                                        }
                                        color="yellow-400"
                                        textColor="black"
                                        onClick={() => {
                                            setSelectedProduct(null);
                                            handleCreateOrder(selectedProduct);
                                        }}
                                        className="modal-order-btn"
                                    />
                                )}

                                <NeoBrutalistButton
                                    text="بستن"
                                    color="gray-400"
                                    textColor="black"
                                    onClick={() => setSelectedProduct(null)}
                                    className="modal-close-btn"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </NeoBrutalistModal>
        </div>
    );
};

export default ProductsPage;