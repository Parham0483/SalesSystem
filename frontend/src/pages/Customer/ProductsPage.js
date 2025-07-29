// frontend/src/pages/ProductsPage.js - UPDATED Customer View
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import '../../styles/component/ProductsPage.css';

const ProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const navigate = useNavigate();

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    useEffect(() => {
        filterAndSortProducts();
    }, [products, searchTerm, filterStatus, sortBy, selectedCategory]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await API.get('/products/');
            setProducts(response.data);
            setError('');
        } catch (err) {
            console.error('❌ Error fetching products:', err);
            if (err.response?.status === 401) {
                setError('نشست شما منقضی شده است. در حال انتقال به صفحه ورود...');
                setTimeout(() => handleLogout(), 2000);
            } else {
                setError('خطا در بارگیری محصولات');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await API.get('/categories/');
            setCategories(response.data);
        } catch (err) {
            console.error('❌ Error fetching categories:', err);
            // Categories are optional, don't show error
        }
    };

    const filterAndSortProducts = () => {
        let filtered = [...products];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (product.category_name && product.category_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (product.tags && product.tags.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // Apply category filter - FIXED to use category ID
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(product =>
                product.category === parseInt(selectedCategory)
            );
        }

        // Apply availability filter (status only, no numbers)
        if (filterStatus !== 'all') {
            filtered = filtered.filter(product => {
                const stockStatus = getStockStatus(product);
                if (filterStatus === 'available') {
                    return stockStatus.status === 'available' || stockStatus.status === 'low_stock';
                } else if (filterStatus === 'unavailable') {
                    return stockStatus.status === 'out_of_stock' || stockStatus.status === 'discontinued';
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
                case 'name':
                    return a.name.localeCompare(b.name, 'fa');
                case 'category':
                    return (a.category_name || '').localeCompare(b.category_name || '', 'fa');
                default:
                    return 0;
            }
        });

        setFilteredProducts(filtered);
    };

    // Enhanced stock status without showing actual numbers - CUSTOMER VIEW
    const getStockStatus = (product) => {
        if (!product.is_active) {
            return {
                status: 'discontinued',
                text: 'متوقف شده',
                color: 'gray-400',
                description: 'این محصول دیگر در دسترس نیست'
            };
        }

        // Use stock_status from API if available, otherwise fall back to stock number
        if (product.stock_status) {
            switch (product.stock_status) {
                case 'out_of_stock':
                    return {
                        status: 'out_of_stock',
                        text: 'ناموجود',
                        color: 'red-400',
                        description: 'موجودی این محصول به پایان رسیده است'
                    };
                case 'in_stock':
                    return {
                        status: 'available',
                        text: 'موجود',
                        color: 'green-400',
                        description: 'این محصول در انبار موجود است'
                    };
                default:
                    return {
                        status: 'unknown',
                        text: 'نامشخص',
                        color: 'gray-400',
                        description: 'وضعیت موجودی مشخص نیست'
                    };
            }
        }

        // Fallback to stock number (but don't show the actual number)
        if (product.stock === 0) {
            return {
                status: 'out_of_stock',
                text: 'ناموجود',
                color: 'red-400',
                description: 'موجودی این محصول به پایان رسیده است'
            };
        } else if (product.stock <= 10) {
            return {
                status: 'low_stock',
                text: 'موجودی کم',
                color: 'yellow-400',
                description: 'موجودی این محصول رو به اتمام است'
            };
        } else {
            return {
                status: 'available',
                text: 'موجود',
                color: 'green-400',
                description: 'این محصول در انبار موجود است'
            };
        }
    };

    const handleProductClick = (product) => {
        setSelectedProduct(product);
    };

    const handleCreateOrder = (product) => {
        const stockStatus = getStockStatus(product);
        navigate('/orders/create', {
            state: {
                preselectedProduct: product,
                stockStatus: stockStatus
            }
        });
    };

    // UPDATED: Better price formatting for customer view
    const formatPrice = (price) => {
        if (!price || price === 0) return 'تماس بگیرید';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
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
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <h1>در حال بارگیری محصولات...</h1>
                    </div>
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
                        <h1 className="products-title">🛍️ کاتالوگ محصولات</h1>
                        <p className="products-subtitle">
                            {filteredProducts.length} محصول یافت شد
                            {selectedCategory !== 'all' && categories.find(c => c.id == selectedCategory) &&
                                ` در دسته ${categories.find(c => c.id == selectedCategory).display_name}`
                            }
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="محموله‌های جدید"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/product/newarrivals')}
                            className="new-arrivals-btn"
                        />
                        <NeoBrutalistButton
                            text="ثبت سفارش"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => navigate('/orders/create')}
                            className="create-order-btn"
                        />
                        <NeoBrutalistButton
                            text="داشبورد"
                            color="green-400"
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
                        onClick={fetchProducts}
                        className="retry-btn"
                    />
                </div>
            )}

            {/* Enhanced Filters */}
            <div className="products-filters">
                <div className="search-section">
                    <NeoBrutalistInput
                        type="text"
                        placeholder="جستجو در نام محصول، توضیحات یا دسته‌بندی..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-section">
                    <div className="filter-group">
                        <label>دسته‌بندی:</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">همه دسته‌ها</option>
                            {categories.map(category => (
                                <option key={category.id} value={category.id}>
                                    {category.display_name || category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>وضعیت موجودی:</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">همه محصولات</option>
                            <option value="available">موجود</option>
                            <option value="unavailable">ناموجود</option>
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
                            <option value="category">دسته‌بندی</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Stats Summary - NO NUMBERS SHOWN */}
            <div className="products-stats">
                <NeoBrutalistCard className="stats-card">
                    <div className="stats-content">
                        <div className="stat-item">
                            <span className="stat-number">
                                {products.filter(p => getStockStatus(p).status === 'available').length}
                            </span>
                            <span className="stat-label">موجود</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">
                                {products.filter(p => getStockStatus(p).status === 'low_stock').length}
                            </span>
                            <span className="stat-label">موجودی کم</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">
                                {products.filter(p => getStockStatus(p).status === 'out_of_stock').length}
                            </span>
                            <span className="stat-label">ناموجود</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-number">
                                {categories.length}
                            </span>
                            <span className="stat-label">دسته‌بندی</span>
                        </div>
                    </div>
                </NeoBrutalistCard>
            </div>

            {/* Products Grid */}
            <div className="products-grid">
                {filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product);
                    const isNew = isNewProduct(product.created_at);

                    return (
                        <NeoBrutalistCard
                            key={product.id}
                            className={`product-card ${stockStatus.status}`}
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
                                        {product.category_name === 'آجیل' ? '🥜' :
                                            product.category_name === 'ادویه' ? '🌶️' : '📦'}
                                        <span>تصویر ندارد</span>
                                    </div>
                                )}

                                {/* New Badge */}
                                {isNew && (
                                    <div className="new-badge">
                                        جدید
                                    </div>
                                )}

                                {/* Stock Status Badge - NO NUMBERS */}
                                <div className={`stock-badge ${stockStatus.status}`}>
                                    {stockStatus.text}
                                </div>

                                {/* Category Badge */}
                                {product.category_name && (
                                    <div className="category-badge">
                                        {product.category_name}
                                    </div>
                                )}
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

                                    <div className="product-availability">
                                        <span className="availability-label">وضعیت:</span>
                                        <span
                                            className={`availability-status ${stockStatus.status}`}
                                            title={stockStatus.description}
                                        >
                                            {stockStatus.text}
                                        </span>
                                    </div>

                                    {product.origin && (
                                        <div className="product-origin">
                                            <span className="origin-label">🌍 مبدأ:</span>
                                            <span className="origin-value">{product.origin}</span>
                                        </div>
                                    )}

                                    {product.sku && (
                                        <div className="product-sku">
                                            <span className="sku-label">کد محصول:</span>
                                            <span className="sku-value">{product.sku}</span>
                                        </div>
                                    )}
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
                                            text={
                                                stockStatus.status === 'out_of_stock'
                                                    ? 'استعلام موجودی'
                                                    : stockStatus.status === 'low_stock'
                                                        ? 'سفارش سریع'
                                                        : 'سفارش دهید'
                                            }
                                            color={
                                                stockStatus.status === 'out_of_stock'
                                                    ? 'yellow-400'
                                                    : stockStatus.status === 'low_stock'
                                                        ? 'yellow-400'
                                                        : 'green-400'
                                            }
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
                            <div className="empty-icon">
                                {searchTerm ? '🔍' : selectedCategory !== 'all' ? '📂' : '📦'}
                            </div>
                            <h3>محصولی یافت نشد</h3>
                            <p>
                                {searchTerm
                                    ? `هیچ محصولی با عبارت "${searchTerm}" یافت نشد.`
                                    : selectedCategory !== 'all'
                                        ? `در دسته انتخاب شده محصولی موجود نیست.`
                                        : 'در حال حاضر محصولی در کاتالوگ موجود نیست.'
                                }
                            </p>
                            <div className="empty-actions">
                                {searchTerm && (
                                    <NeoBrutalistButton
                                        text="پاک کردن جستجو"
                                        color="blue-400"
                                        textColor="white"
                                        onClick={() => setSearchTerm('')}
                                        className="clear-search-btn"
                                    />
                                )}
                                {selectedCategory !== 'all' && (
                                    <NeoBrutalistButton
                                        text="مشاهده همه دسته‌ها"
                                        color="green-400"
                                        textColor="black"
                                        onClick={() => setSelectedCategory('all')}
                                        className="show-all-btn"
                                    />
                                )}
                                <NeoBrutalistButton
                                    text="درخواست محصول خاص"
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
                                    {selectedProduct.category_name === 'آجیل' ? '🥜' :
                                        selectedProduct.category_name === 'ادویه' ? '🌶️' : '📦'}
                                    <span>تصویر موجود نیست</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-product-info">
                            <h2 className="modal-product-name">{selectedProduct.name}</h2>

                            {/* Enhanced Stock Status Display - NO NUMBERS */}
                            <div className="modal-stock-section">
                                <div className="modal-stock-status">
                                    <NeoBrutalistButton
                                        text={getStockStatus(selectedProduct).text}
                                        color={getStockStatus(selectedProduct).color}
                                        textColor="black"
                                        className="modal-status-badge"
                                    />
                                </div>
                                <p className="stock-description">
                                    {getStockStatus(selectedProduct).description}
                                </p>
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

                                {selectedProduct.category_name && (
                                    <div className="detail-row">
                                        <span className="detail-label">دسته‌بندی:</span>
                                        <span className="detail-value">
                                            {selectedProduct.category_name}
                                        </span>
                                    </div>
                                )}

                                {selectedProduct.sku && (
                                    <div className="detail-row">
                                        <span className="detail-label">کد محصول:</span>
                                        <span className="detail-value">
                                            {selectedProduct.sku}
                                        </span>
                                    </div>
                                )}

                                {selectedProduct.origin && (
                                    <div className="detail-row">
                                        <span className="detail-label">مبدأ:</span>
                                        <span className="detail-value">
                                            {selectedProduct.origin}
                                        </span>
                                    </div>
                                )}

                                {selectedProduct.weight && (
                                    <div className="detail-row">
                                        <span className="detail-label">وزن:</span>
                                        <span className="detail-value">
                                            {selectedProduct.weight} کیلوگرم
                                        </span>
                                    </div>
                                )}

                                <div className="detail-row">
                                    <span className="detail-label">وضعیت موجودی:</span>
                                    <span className={`detail-value status-${getStockStatus(selectedProduct).status}`}>
                                        {getStockStatus(selectedProduct).text}
                                    </span>
                                </div>

                                <div className="detail-row">
                                    <span className="detail-label">تاریخ افزودن:</span>
                                    <span className="detail-value">
                                        {new Date(selectedProduct.created_at).toLocaleDateString('fa-IR')}
                                    </span>
                                </div>

                                {isNewProduct(selectedProduct.created_at) && (
                                    <div className="detail-row">
                                        <span className="detail-label">وضعیت:</span>
                                        <span className="detail-value new-product-label">
                                            🆕 محصول جدید
                                        </span>
                                    </div>
                                )}

                                {selectedProduct.tags && (
                                    <div className="detail-row">
                                        <span className="detail-label">برچسب‌ها:</span>
                                        <span className="detail-value">
                                            {selectedProduct.tags}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Availability Notice */}
                            {getStockStatus(selectedProduct).status === 'out_of_stock' && (
                                <div className="availability-notice out-of-stock">
                                    <h4>📋 درخواست موجودی</h4>
                                    <p>
                                        این محصول در حال حاضر در انبار موجود نیست.
                                        می‌توانید درخواست موجودی ثبت کنید تا در صورت ورود به انبار،
                                        با شما تماس بگیریم.
                                    </p>
                                </div>
                            )}

                            {getStockStatus(selectedProduct).status === 'low_stock' && (
                                <div className="availability-notice low-stock">
                                    <h4>⚠️ موجودی محدود</h4>
                                    <p>
                                        موجودی این محصول محدود است.
                                        برای سفارش هر چه سریعتر اقدام کنید.
                                    </p>
                                </div>
                            )}

                            <div className="modal-actions">
                                {getStockStatus(selectedProduct).status !== 'discontinued' && (
                                    <NeoBrutalistButton
                                        text={
                                            getStockStatus(selectedProduct).status === 'out_of_stock'
                                                ? 'درخواست موجودی'
                                                : getStockStatus(selectedProduct).status === 'low_stock'
                                                    ? 'سفارش فوری'
                                                    : 'سفارش این محصول'
                                        }
                                        color={
                                            getStockStatus(selectedProduct).status === 'available'
                                                ? 'green-400'
                                                : 'yellow-400'
                                        }
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