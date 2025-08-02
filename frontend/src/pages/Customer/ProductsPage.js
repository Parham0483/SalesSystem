import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api';
import { useAuth } from '../../hooks/useAuth';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistDropdown from "../../component/NeoBrutalist/NeoBrutalistDropdown";
import '../../styles/component/CustomerComponent/ProductsPage.css';
import {Filter, Search} from "lucide-react";

const ProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const [filterStatus, setFilterStatus] = useState('all'); // For stock status
    const [selectedCategory, setSelectedCategory] = useState('all'); // For category
    const [sortBy, setSortBy] = useState('newest');
    const [categories, setCategories] = useState([]);

    const navigate = useNavigate();
    const { isDealer } = useAuth();

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
        }
    };

    const filterAndSortProducts = () => {
        let filtered = [...products];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (product.category_name && product.category_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (product.tags && product.tags.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // Category filter
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(product =>
                product.category === parseInt(selectedCategory)
            );
        }

        // Stock status filter
        if (filterStatus !== 'all') {
            filtered = filtered.filter(product => {
                const stockStatus = getStockStatus(product);
                if (filterStatus === 'in_stock') {
                    return stockStatus.status === 'available';
                } else if (filterStatus === 'low_stock') {
                    return stockStatus.status === 'low_stock';
                } else if (filterStatus === 'out_of_stock') {
                    return stockStatus.status === 'out_of_stock';
                } else if (filterStatus === 'available') {
                    return stockStatus.status === 'available' || stockStatus.status === 'low_stock';
                } else if (filterStatus === 'unavailable') {
                    return stockStatus.status === 'out_of_stock' || stockStatus.status === 'discontinued';
                }
                return true;
            });
        }

        // Sort products
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

    const getStockStatus = (product) => {
        if (!product.is_active) {
            return { status: 'discontinued', text: 'متوقف شده', color: 'gray-400', description: 'این محصول دیگر در دسترس نیست' };
        }
        if (product.stock_status) {
            switch (product.stock_status) {
                case 'out_of_stock': return { status: 'out_of_stock', text: 'ناموجود', color: 'red-400', description: 'موجودی این محصول به پایان رسیده است' };
                case 'in_stock': return { status: 'available', text: 'موجود', color: 'green-400', description: 'این محصول در انبار موجود است' };
                default: return { status: 'unknown', text: 'نامشخص', color: 'gray-400', description: 'وضعیت موجودی مشخص نیست' };
            }
        }
        if (product.stock === 0) {
            return { status: 'out_of_stock', text: 'ناموجود', color: 'red-400', description: 'موجودی این محصول به پایان رسیده است' };
        } else if (product.stock <= 50) {
            return { status: 'low_stock', text: 'موجودی کم', color: 'yellow-400', description: 'موجودی این محصول رو به اتمام است' };
        } else {
            return { status: 'available', text: 'موجود', color: 'green-400', description: 'این محصول در انبار موجود است' };
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterStatus('all');
        setSelectedCategory('all');
        setSortBy('newest');
    };

    const stockOptions = [
        { value: 'all', label: 'همه موجودی‌ها' },
        { value: 'in_stock', label: 'موجود' },
        { value: 'low_stock', label: 'موجودی کم' },
        { value: 'out_of_stock', label: 'ناموجود' }
    ];

    const categoryOptions = [
        { value: 'all', label: 'همه دسته‌ها' },
        ...categories.map(cat => ({
            value: cat.id,
            label: cat.display_name || cat.name
        }))
    ];

    const handleProductClick = (product) => setSelectedProduct(product);

    const handleCreateOrder = (product) => {
        const stockStatus = getStockStatus(product);
        navigate('/orders/create', { state: { preselectedProduct: product, stockStatus: stockStatus } });
    };

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
        return <div className="products-page"><div className="products-header"><div className="loading-container"><div className="loading-spinner"></div><h1>در حال بارگیری محصولات...</h1></div></div></div>;
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

                        {!isDealer && (
                            <NeoBrutalistButton
                                text="ثبت سفارش"
                                color="yellow-400"
                                textColor="black"
                                onClick={() => navigate('/orders/create')}
                                className="create-order-btn"
                            />
                        )}

                        {!isDealer && (
                            <NeoBrutalistButton text="داشبورد" color="purple-400" textColor="black" onClick={() => navigate('/dashboard')} className="dashboard-btn" />
                        )}
                        {isDealer && (
                            <NeoBrutalistButton text="داشبورد" color="purple-400" textColor="black" onClick={() => navigate('/dealer')} className="dashboard-btn" />
                        )}
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
                    <NeoBrutalistButton text="تلاش مجدد" color="blue-400" textColor="white" onClick={fetchProducts} className="retry-btn" />
                </div>
            )}

            <NeoBrutalistCard className="filters-card">
                <div className="filters-header">
                    <h3>
                        <Filter size={20} />
                        فیلترها و جستجو
                    </h3>
                    <NeoBrutalistButton
                        text="پاک کردن فیلترها"
                        color="red-400"
                        textColor="white"
                        onClick={clearFilters}
                    />
                </div>

                <div className="filters-grid">
                    <div className="search-wrapper">
                        <Search className="search-icon" />
                        <NeoBrutalistInput
                            placeholder="جستجو در نام، توضیحات یا دسته..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <NeoBrutalistDropdown
                        label="موجودی"
                        options={stockOptions}
                        value={filterStatus}
                        onChange={(value) => setFilterStatus(value)}
                    />

                    <NeoBrutalistDropdown
                        label="دسته‌بندی"
                        options={categoryOptions}
                        value={selectedCategory}
                        onChange={(value) => setSelectedCategory(value)}
                    />
                </div>
            </NeoBrutalistCard>

            <div className="products-stats">
                <NeoBrutalistCard className="stats-card">
                    <div className="stats-content">
                        <div className="stat-item"><span className="stat-number">{products.filter(p => getStockStatus(p).status === 'available').length}</span><span className="stat-label">موجود</span></div>
                        <div className="stat-item"><span className="stat-number">{products.filter(p => getStockStatus(p).status === 'low_stock').length}</span><span className="stat-label">موجودی کم</span></div>
                        <div className="stat-item"><span className="stat-number">{products.filter(p => getStockStatus(p).status === 'out_of_stock').length}</span><span className="stat-label">ناموجود</span></div>
                        <div className="stat-item"><span className="stat-number">{categories.length}</span><span className="stat-label">دسته‌بندی</span></div>
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
                            <div className="product-image-container">
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="product-image" onError={(e) => { e.target.src = '/placeholder-product.png'; }} />
                                ) : (
                                    <div className="product-image-placeholder">
                                        {product.category_name === 'آجیل' ? '🥜' : product.category_name === 'ادویه' ? '🌶️' : '📦'}
                                        <span>تصویر ندارد</span>
                                    </div>
                                )}
                                {isNew && ( <div className="new-badge"> جدید </div> )}
                                {product.category_name && ( <div className="category-badge"> {product.category_name} </div> )}
                            </div>
                            <div className="product-info">
                                <h3 className="product-name">{product.name}</h3>
                                <p className="product-description">
                                    {product.description.length > 100 ? `${product.description.substring(0, 100)}...` : product.description}
                                </p>
                                <div className="product-details">
                                    <div className="product-price"><span className="price-label">قیمت پایه:</span><span className="price-value">{formatPrice(product.base_price)}</span></div>
                                    <div className="product-availability"><span className="availability-label">وضعیت:</span><span className={`availability-status ${stockStatus.status}`} title={stockStatus.description}>{stockStatus.text}</span></div>
                                    {product.origin && ( <div className="product-origin"><span className="origin-label">🌍 مبدأ:</span><span className="origin-value">{product.origin}</span></div> )}
                                    {product.sku && ( <div className="product-sku"><span className="sku-label">کد محصول:</span><span className="sku-value">{product.sku}</span></div> )}
                                </div>
                                <div className="product-actions">
                                    <NeoBrutalistButton text="مشاهده جزئیات" color="blue-400" textColor="white" onClick={(e) => { e.stopPropagation(); handleProductClick(product); }} className="details-btn"/>

                                    {!isDealer && stockStatus.status !== 'discontinued' && (
                                        <NeoBrutalistButton
                                            text={ stockStatus.status === 'out_of_stock' ? 'استعلام موجودی' : stockStatus.status === 'low_stock' ? 'سفارش سریع' : 'سفارش دهید' }
                                            color={ stockStatus.status === 'out_of_stock' ? 'yellow-400' : stockStatus.status === 'low_stock' ? 'yellow-400' : 'green-400' }
                                            textColor="black"
                                            onClick={(e) => { e.stopPropagation(); handleCreateOrder(product); }}
                                            className="order-btn"
                                        />
                                    )}
                                </div>
                            </div>
                        </NeoBrutalistCard>
                    );
                })}
            </div>

            {filteredProducts.length === 0 && !loading && (
                <div className="empty-state">
                    <h2>هیچ محصولی یافت نشد</h2>
                    <p>لطفاً فیلترهای خود را تغییر دهید یا جستجوی جدیدی انجام دهید</p>
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
                                <img src={selectedProduct.image_url} alt={selectedProduct.name} className="modal-image" onError={(e) => { e.target.src = '/placeholder-product.png'; }} />
                            ) : (
                                <div className="modal-image-placeholder">
                                    {selectedProduct.category_name === 'آجیل' ? '🥜' : selectedProduct.category_name === 'ادویه' ? '🌶️' : '📦'}
                                    <span>تصویر موجود نیست</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-product-info">
                            <h2 className="modal-product-name">{selectedProduct.name}</h2>
                            <NeoBrutalistButton text={getStockStatus(selectedProduct).text} color={getStockStatus(selectedProduct).color} textColor="black" className="modal-status-badge"/>
                            <div className="modal-product-description">
                                <h4>توضیحات محصول:</h4>
                                <p>{selectedProduct.description}</p>
                            </div>

                            {getStockStatus(selectedProduct).status === 'out_of_stock' && (
                                <div className="availability-notice out-of-stock">
                                    <p>این محصول در حال حاضر موجود نیست</p>
                                </div>
                            )}
                            {getStockStatus(selectedProduct).status === 'low_stock' && (
                                <div className="availability-notice low-stock">
                                    <p>موجودی این محصول کم است، در اسرع وقت سفارش دهید</p>
                                </div>
                            )}

                            <div className="modal-actions">
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