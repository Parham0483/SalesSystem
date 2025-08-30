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

    // Add state for modal image gallery
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [fullscreenImage, setFullscreenImage] = useState(null);

    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
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

    // Reset image index when product changes
    useEffect(() => {
        setCurrentImageIndex(0);
    }, [selectedProduct]);

    // Handle ESC key and arrow keys for fullscreen image
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!fullscreenImage) return;

            if (event.key === 'Escape') {
                setFullscreenImage(null);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                const productImages = getProductImages(selectedProduct);
                if (productImages.length <= 1) return;

                const currentIndex = productImages.findIndex(img => img.image_url === fullscreenImage.url);
                let newIndex;

                if (event.key === 'ArrowLeft') {
                    newIndex = currentIndex === 0 ? productImages.length - 1 : currentIndex - 1;
                } else {
                    newIndex = currentIndex === productImages.length - 1 ? 0 : currentIndex + 1;
                }

                setFullscreenImage({
                    url: productImages[newIndex].image_url,
                    productName: selectedProduct.name,
                    index: newIndex + 1,
                    total: productImages.length
                });
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [fullscreenImage, selectedProduct]);

    // Prevent body scroll when fullscreen is open
    useEffect(() => {
        if (fullscreenImage) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [fullscreenImage]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await API.get('/products/');
            setProducts(response.data);
            setError('');
        } catch (err) {
            console.error('Error fetching products:', err);
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
            console.error('Error fetching categories:', err);
        }
    };

    // Helper function to get product image URL
    const getProductImageUrl = (product) => {
        // Priority: primary_image_url > first image from images array > fallback
        if (product.primary_image_url) {
            return product.primary_image_url;
        }
        if (product.images && product.images.length > 0) {
            return product.images[0].image_url;
        }
        return product.image_url; // fallback to old field
    };

    // Helper function to get second image for hover effect
    const getSecondImageUrl = (product) => {
        if (product.images && product.images.length > 1) {
            return product.images[1].image_url;
        }
        return null;
    };

    // Helper function to get all product images
    const getProductImages = (product) => {
        if (product.images && product.images.length > 0) {
            return product.images;
        }
        // Fallback to single image
        if (product.image_url || product.primary_image_url) {
            return [{
                image_url: product.primary_image_url || product.image_url,
                is_primary: true,
                id: 'fallback'
            }];
        }
        return [];
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

    const handleImageClick = (imageUrl, productName, imageIndex = null) => {
        setFullscreenImage({
            url: imageUrl,
            productName: productName,
            index: imageIndex,
            total: selectedProduct ? getProductImages(selectedProduct).length : 1
        });
    };

    const handleFullscreenClose = () => {
        setFullscreenImage(null);
    };

    const handleFullscreenNavigation = (direction) => {
        if (!selectedProduct) return;

        const productImages = getProductImages(selectedProduct);
        if (productImages.length <= 1) return;

        const currentIndex = productImages.findIndex(img => img.image_url === fullscreenImage.url);
        let newIndex;

        if (direction === 'prev') {
            newIndex = currentIndex === 0 ? productImages.length - 1 : currentIndex - 1;
        } else {
            newIndex = currentIndex === productImages.length - 1 ? 0 : currentIndex + 1;
        }

        setFullscreenImage({
            url: productImages[newIndex].image_url,
            productName: selectedProduct.name,
            index: newIndex + 1,
            total: productImages.length
        });
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
                        <h1 className="products-title">🛒 کاتالوگ محصولات</h1>
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

            {/* Clean Products Grid with Hover Effects */}
            <div className="products-grid">
                {filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product);
                    const isNew = isNewProduct(product.created_at);
                    const primaryImage = getProductImageUrl(product);
                    const secondaryImage = getSecondImageUrl(product);
                    const productImages = getProductImages(product);

                    return (
                        <NeoBrutalistCard
                            key={product.id}
                            className={`product-card ${stockStatus.status} ${productImages.length > 1 ? 'has-multiple-images' : ''}`}
                            onClick={() => handleProductClick(product)}
                        >
                            <div className="product-image-container">
                                {primaryImage ? (
                                    <>
                                        <img
                                            src={primaryImage}
                                            alt={product.name}
                                            className="product-image"
                                            onError={(e) => { e.target.src = '/placeholder-product.png'; }}
                                        />
                                        {/* Second image for hover effect */}
                                        {secondaryImage && (
                                            <img
                                                src={secondaryImage}
                                                alt={`${product.name} - دوم`}
                                                className="product-image-secondary"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <div className="product-image-placeholder">
                                        {product.category_name === 'آجیل' ? '🥜' : product.category_name === 'ادویه' ? '🌶️' : '📦'}
                                        <span>تصویر ندارد</span>
                                    </div>
                                )}

                                {/* Multiple Images Indicator */}
                                {productImages.length > 1 && (
                                    <div className="images-indicator">
                                         {productImages.length}
                                    </div>
                                )}
                            </div>

                            <div className="product-info">
                                <h3 className="product-name">{product.name}</h3>
                                <p className="product-description">
                                    {product.description.length > 80 ? `${product.description.substring(0, 80)}...` : product.description}
                                </p>
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

            {/* Enhanced Product Detail Modal with Full Image Gallery */}
            <NeoBrutalistModal
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                title=""
                size="large"
            >
                {selectedProduct && (
                    <div className="product-detail-modal" dir="rtl">
                        {/* Product Name and Status at Top */}
                        <div className="modal-header-section">
                            <h2 className="modal-product-name">{selectedProduct.name}</h2>
                            <div className={`modal-status-badge ${getStockStatus(selectedProduct).status}`}>
                                {getStockStatus(selectedProduct).text}
                            </div>
                        </div>

                        {/* Image Gallery and Description Row */}
                        <div className="modal-main-content">
                            {/* Enhanced Image Gallery Section */}
                            <div className="modal-product-images">
                                {(() => {
                                    const productImages = getProductImages(selectedProduct);

                                    if (productImages.length > 0) {
                                        return (
                                            <div className="image-gallery">
                                                {/* Main Image */}
                                                <div className="main-image-container">
                                                    <img
                                                        src={productImages[currentImageIndex]?.image_url}
                                                        alt={selectedProduct.name}
                                                        className="modal-main-image"
                                                        onClick={() => handleImageClick(
                                                            productImages[currentImageIndex]?.image_url,
                                                            selectedProduct.name,
                                                            currentImageIndex + 1
                                                        )}
                                                        onError={(e) => { e.target.src = '/placeholder-product.png'; }}
                                                    />

                                                    {/* Image Navigation */}
                                                    {productImages.length > 1 && (
                                                        <>
                                                            <button
                                                                className="image-nav prev"
                                                                onClick={() => setCurrentImageIndex(prev =>
                                                                    prev === 0 ? productImages.length - 1 : prev - 1
                                                                )}
                                                            >
                                                                ❯
                                                            </button>
                                                            <button
                                                                className="image-nav next"
                                                                onClick={() => setCurrentImageIndex(prev =>
                                                                    prev === productImages.length - 1 ? 0 : prev + 1
                                                                )}
                                                            >
                                                                ❮
                                                            </button>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Thumbnail Strip */}
                                                {productImages.length > 1 && (
                                                    <div className="image-thumbnails">
                                                        {productImages.map((image, index) => (
                                                            <img
                                                                key={image.id || index}
                                                                src={image.image_url}
                                                                alt={`${selectedProduct.name} ${index + 1}`}
                                                                className={`thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (e.detail === 1) {
                                                                        // Single click - change main image
                                                                        setCurrentImageIndex(index);
                                                                    } else if (e.detail === 2) {
                                                                        // Double click - open fullscreen
                                                                        handleImageClick(image.image_url, selectedProduct.name, index + 1);
                                                                    }
                                                                }}
                                                                onError={(e) => { e.target.src = '/placeholder-product.png'; }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Image Counter */}
                                                {productImages.length > 1 && (
                                                    <div className="image-counter">
                                                        {currentImageIndex + 1} از {productImages.length}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="modal-image-placeholder">
                                                {selectedProduct.category_name === 'آجیل' ? '🥜' :
                                                    selectedProduct.category_name === 'ادویه' ? '🌶️' : '📦'}
                                                <span>تصویر موجود نیست</span>
                                            </div>
                                        );
                                    }
                                })()}
                            </div>

                            <div className="modal-product-description">
                                <h4>توضیحات محصول:</h4>
                                <p>{selectedProduct.description}</p>
                            </div>
                        </div>

                        {/* Stock Status Notice */}
                        {getStockStatus(selectedProduct).status === 'out_of_stock' && (
                            <div className="availability-notice out-of-stock">
                                <p>این محصول در حال حاضر موجود نیست. برای اطلاع از زمان موجودی مجدد با ما تماس بگیرید.</p>
                            </div>
                        )}

                        {getStockStatus(selectedProduct).status === 'low_stock' && (
                            <div className="availability-notice low-stock">
                                <p>موجودی این محصول کم است، در اسرع وقت سفارش دهید.</p>
                            </div>
                        )}

                        {getStockStatus(selectedProduct).status === 'discontinued' && (
                            <div className="availability-notice discontinued">
                                <p>این محصول دیگر در دسترس نیست و تولید آن متوقف شده است.</p>
                            </div>
                        )}

                        {/* Detailed Information */}
                        <div className="modal-product-details">
                            <h4>اطلاعات تفصیلی:</h4>

                            <div className="details-grid">
                                <div className="detail-item">
                                    <span className="detail-label">قیمت پایه:</span>
                                    <span className="detail-value price-value">
                                        {formatPrice(selectedProduct.base_price)}
                                    </span>
                                </div>

                                <div className="detail-item">
                                    <span className="detail-label">وضعیت موجودی:</span>
                                    <span className={`detail-value status-${getStockStatus(selectedProduct).status}`}>
                                        {getStockStatus(selectedProduct).text}
                                    </span>
                                </div>

                                {selectedProduct.origin && (
                                    <div className="detail-item">
                                        <span className="detail-label">مبدأ:</span>
                                        <span className="detail-value">{selectedProduct.origin}</span>
                                    </div>
                                )}

                                {selectedProduct.sku && (
                                    <div className="detail-item">
                                        <span className="detail-label">کد محصول:</span>
                                        <span className="detail-value sku-code">{selectedProduct.sku}</span>
                                    </div>
                                )}

                                {selectedProduct.category_name && (
                                    <div className="detail-item">
                                        <span className="detail-label">دسته‌بندی:</span>
                                        <span className="detail-value">{selectedProduct.category_name}</span>
                                    </div>
                                )}

                                <div className="detail-item">
                                    <span className="detail-label">تاریخ افزوده شدن:</span>
                                    <span className="detail-value">
                                        {new Date(selectedProduct.created_at).toLocaleDateString('fa-IR')}
                                        {isNewProduct(selectedProduct.created_at) && (
                                            <span className="new-label">جدید</span>
                                        )}
                                    </span>
                                </div>

                                {/* Show image count if multiple images */}
                                {getProductImages(selectedProduct).length > 1 && (
                                    <div className="detail-item">
                                        <span className="detail-label">تعداد تصاویر:</span>
                                        <span className="detail-value">
                                            {getProductImages(selectedProduct).length} تصویر
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
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
                )}
            </NeoBrutalistModal>

            {/* Fullscreen Image Modal */}
            {fullscreenImage && (
                <div
                    className="fullscreen-image-overlay"
                    onClick={handleFullscreenClose}
                >
                    <button
                        className="fullscreen-close-btn"
                        onClick={handleFullscreenClose}
                        aria-label="بستن تصویر"
                    >
                        ✕
                    </button>

                    <img
                        src={fullscreenImage.url}
                        alt={fullscreenImage.productName}
                        className="fullscreen-image"
                        onClick={(e) => e.stopPropagation()}
                        onError={(e) => { e.target.src = '/placeholder-product.png'; }}
                    />

                    <div className="fullscreen-image-info">
                        <strong>{fullscreenImage.productName}</strong>
                        {fullscreenImage.index && (
                            <span> - تصویر {fullscreenImage.index} از {fullscreenImage.total}</span>
                        )}
                        <br />
                        <small>برای بستن کلیک کنید یا ESC فشار دهید</small>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductsPage;