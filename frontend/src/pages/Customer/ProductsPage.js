import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api';
import { useAuth } from '../../hooks/useAuth';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistDropdown from '../../component/NeoBrutalist/NeoBrutalistDropdown';
import '../../styles/component/CustomerComponent/ProductsPage.css';
import { Filter, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const ProductsPage = () => {
    // State declarations
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [sortBy, setSortBy] = useState('-created_at');
    const [categories, setCategories] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [fullscreenImage, setFullscreenImage] = useState(null);

    // Pagination state
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const [productsPerPage] = useState(9);
    const [totalPages, setTotalPages] = useState(0);

    // Hooks
    const navigate = useNavigate();
    const { isDealer = false } = useAuth();

    // Calculate pagination info
    const startIndex = (currentPage - 1) * productsPerPage + 1;
    const endIndex = Math.min(currentPage * productsPerPage, totalProducts);

    // FIXED: Image handling functions
    const getImageUrl = (product, preferThumbnail = false) => {
        if (!product) return '/placeholder-product.png';

        if (preferThumbnail && product.thumbnail_url) {
            return product.thumbnail_url;
        }

        if (product.primary_image_url) {
            return product.primary_image_url;
        }

        if (product.image_url) {
            return product.image_url;
        }

        if (product.product_images && product.product_images.length > 0) {
            const firstImage = product.product_images[0];
            if (firstImage.image_url || firstImage.image) {
                return firstImage.image_url || firstImage.image;
            }
        }

        return '/placeholder-product.png';
    };

    const getSecondImageUrl = (product) => {
        if (!product || !product.product_images || product.product_images.length <= 1) {
            return null;
        }
        const secondImage = product.product_images[1];
        return secondImage.image_url || secondImage.image;
    };

    const getProductImages = (product) => {
        if (!product) return [];

        let images = [];

        if (product.product_images && Array.isArray(product.product_images) && product.product_images.length > 0) {
            images = product.product_images.map(img => ({
                id: img.id || Math.random(),
                image_url: img.image_url || img.image,
                is_primary: img.is_primary || false,
                alt_text: img.alt_text || ''
            }));
        }

        if (images.length === 0) {
            if (product.primary_image_url) {
                images.push({
                    id: 'primary',
                    image_url: product.primary_image_url,
                    is_primary: true,
                    alt_text: product.name || ''
                });
            } else if (product.image_url) {
                images.push({
                    id: 'fallback',
                    image_url: product.image_url,
                    is_primary: true,
                    alt_text: product.name || ''
                });
            }
        }

        return images;
    };

    const getStockStatus = (product) => {
        if (!product || !product.is_active) {
            return { status: 'discontinued', text: 'متوقف شده', color: 'gray-400' };
        }
        if (product.stock_status === 'out_of_stock' || product.stock === 0) {
            return { status: 'out_of_stock', text: 'ناموجود', color: 'red-400' };
        } else if (product.stock_status === 'in_stock' || product.stock > 50) {
            return { status: 'available', text: 'موجود', color: 'green-400' };
        } else if (product.stock <= 50) {
            return { status: 'low_stock', text: 'موجودی کم', color: 'yellow-400' };
        }
        return { status: 'available', text: 'موجود', color: 'green-400' };
    };

    const formatPrice = (price) => {
        if (!price || price === 0) return 'تماس بگیرید';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
    };

    const formatWeight = (weight) => {
        if (!weight || weight === 0) return 'نامشخص';
        return `${parseFloat(weight).toLocaleString('fa-IR')} کیلوگرم`;
    };

    const formatTaxRate = (taxRate) => {
        if (!taxRate || taxRate === 0) return '0%';
        return `${parseFloat(taxRate).toLocaleString('fa-IR')}%`;
    };

    const isNewProduct = (createdAt) => {
        if (!createdAt) return false;
        const productDate = new Date(createdAt);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return productDate > oneWeekAgo;
    };

    // Event handlers
    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterStatus('all');
        setSelectedCategory('all');
        setSortBy('-created_at');
        setCurrentPage(1);
    };

    const handleProductClick = (product) => {
        setSelectedProduct(product);
    };

    const handleImageClick = (imageUrl, productName, imageIndex = null) => {
        setFullscreenImage({
            url: imageUrl,
            productName: productName || 'بدون نام',
            index: imageIndex,
            total: selectedProduct ? getProductImages(selectedProduct).length : 1
        });
    };

    const handleFullscreenClose = () => {
        setFullscreenImage(null);
    };

    const handleCreateOrder = (product) => {
        if (!product) return;
        const stockStatus = getStockStatus(product);
        navigate('/orders/create', { state: { preselectedProduct: product, stockStatus } });
    };

    // FIXED: Simplified pagination (similar to AdminProductsPage)
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage && !loading) {
            console.log('Changing to page:', newPage);
            fetchProducts(newPage);
        }
    };

    const fetchProducts = useCallback(async (page = 1) => {
        console.log('=== FETCHING PRODUCTS ===');
        console.log('Page:', page, 'Offset:', (page - 1) * productsPerPage);
        setLoading(true);
        try {
            const params = {
                limit: productsPerPage,
                offset: (page - 1) * productsPerPage,
                ordering: sortBy,
                _t: Date.now()
            };
            if (searchTerm) params.search = searchTerm;
            if (selectedCategory && selectedCategory !== 'all') params.category_id = selectedCategory;
            if (filterStatus && filterStatus !== 'all') params.status = filterStatus;
            console.log('API params:', params);
            const response = await API.get('/products/', { params });
            console.log('API Response:', {
                count: response.data.count,
                results: response.data.results.map(p => p.id),
                next: response.data.next,
                previous: response.data.previous
            });
            const responseData = response.data;
            const productsData = responseData.results || responseData;
            if (!Array.isArray(productsData)) {
                console.error('API returned non-array data:', responseData);
                throw new Error('API did not return valid products array');
            }
            setProducts([...productsData]); // Force new array for state update
            setTotalProducts(responseData.count || productsData.length);
            setTotalPages(Math.ceil((responseData.count || productsData.length) / productsPerPage));
            setCurrentPage(page);
            setError('');
        } catch (err) {
            console.error('Error fetching products:', err);
            setError('خطا در بارگیری محصولات');
            setProducts([]);
            setTotalProducts(0);
            setTotalPages(0);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterStatus, selectedCategory, sortBy, productsPerPage]);

    const fetchCategories = async () => {
        try {
            const response = await API.get('/products/categories/');
            setCategories(response.data || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
            try {
                const response2 = await API.get('/categories/');
                setCategories(response2.data || []);
            } catch (err2) {
                console.error('Error fetching categories from alternative endpoint:', err2);
            }
        }
    };

    // Options arrays
    const stockOptions = [
        { value: 'all', label: 'همه موجودی‌ها' },
        { value: 'in_stock', label: 'موجود' },
        { value: 'low_stock', label: 'موجودی کم' },
        { value: 'out_of_stock', label: 'ناموجود' }
    ];

    const categoryOptions = [
        { value: 'all', label: 'همه دسته‌ها' },
        ...categories.map(cat => ({
            value: cat?.id?.toString() || cat?.name,
            label: cat?.display_name || cat?.name_fa || cat?.name || 'بدون نام'
        }))
    ];

    const sortOptions = [
        { value: '-created_at', label: 'جدیدترین' },
        { value: 'created_at', label: 'قدیمی‌ترین' },
        { value: 'name', label: 'نام (الف - ی)' },
        { value: '-name', label: 'نام (ی - الف)' },
        { value: 'base_price', label: 'قیمت (کم به زیاد)' },
        { value: '-base_price', label: 'قیمت (زیاد به کم)' },
        { value: '-stock', label: 'موجودی (زیاد به کم)' },
        { value: 'stock', label: 'موجودی (کم به زیاد)' }
    ];

    // Effects
    useEffect(() => {
        fetchCategories();
    }, []);

    // FIXED: Simple effect pattern (like AdminProductsPage)
    useEffect(() => {
        console.log('Filters changed, fetching page 1');
        fetchProducts(1);
    }, [searchTerm, filterStatus, selectedCategory, sortBy, fetchProducts]);

    useEffect(() => {
        setCurrentImageIndex(0);
    }, [selectedProduct]);

    useEffect(() => {
        document.body.style.overflow = fullscreenImage ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [fullscreenImage]);

    // Generate page numbers for pagination
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;

        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return pages;
    };

    // Loading state
    if (loading && currentPage === 1 && !products?.length) {
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
            <div className="products-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="products-title">🛒 کاتالوگ محصولات</h1>
                        <p className="products-subtitle">
                            نمایش {startIndex} تا {endIndex} از {totalProducts} محصول
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="محموله‌های جدید"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/product/newarrivals')}
                        />
                        {!isDealer && (
                            <>
                                <NeoBrutalistButton
                                    text="ثبت سفارش"
                                    color="yellow-400"
                                    textColor="black"
                                    onClick={() => navigate('/orders/create')}
                                />
                                <NeoBrutalistButton
                                    text="داشبورد"
                                    color="purple-400"
                                    textColor="black"
                                    onClick={() => navigate('/dashboard')}
                                />
                            </>
                        )}
                        {isDealer && (
                            <NeoBrutalistButton
                                text="داشبورد"
                                color="purple-400"
                                textColor="black"
                                onClick={() => navigate('/dealer')}
                            />
                        )}
                        <NeoBrutalistButton
                            text="خروج"
                            color="red-400"
                            textColor="white"
                            onClick={handleLogout}
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
                        onClick={() => fetchProducts(currentPage)}
                    />
                </div>
            )}

            <NeoBrutalistCard className="filters-card">
                <div className="filters-header">
                    <h3><Filter size={20} /> فیلترها و جستجو</h3>
                    <div className="filters-actions">
                        <NeoBrutalistButton
                            text="پاک کردن فیلترها"
                            color="red-400"
                            textColor="white"
                            onClick={clearFilters}
                        />
                    </div>
                </div>
                <div className="filters-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                    <div className="search-wrapper">
                        <Search className="search-icon" />
                        <NeoBrutalistInput
                            placeholder="جستجو در نام، توضیحات یا دسته..."
                            value={searchTerm || ''}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <NeoBrutalistDropdown
                        label="موجودی"
                        options={stockOptions}
                        value={filterStatus || 'all'}
                        onChange={(value) => setFilterStatus(value)}
                    />
                    <NeoBrutalistDropdown
                        label="دسته‌بندی"
                        options={categoryOptions}
                        value={selectedCategory || 'all'}
                        onChange={(value) => setSelectedCategory(value)}
                    />
                    <NeoBrutalistDropdown
                        label="مرتب‌سازی"
                        options={sortOptions}
                        value={sortBy || '-created_at'}
                        onChange={(value) => setSortBy(value)}
                    />
                </div>
            </NeoBrutalistCard>

            <div className="products-grid-wrapper">
                {loading && (
                    <div className="loading-overlay">
                        <div className="loading-spinner"></div>
                        <span>در حال بارگیری...</span>
                    </div>
                )}

                <div className="products-grid">
                    {products?.length > 0 ? (
                        products.map((product, index) => {
                            const imageUrl = getImageUrl(product);
                            const secondImageUrl = getSecondImageUrl(product);
                            const hasMultipleImages = secondImageUrl && secondImageUrl !== imageUrl;

                            return (
                                <NeoBrutalistCard
                                    key={`${product.id}-${currentPage}`}
                                    className={`product-card ${hasMultipleImages ? 'has-hover-image' : 'single-image'}`}
                                    onClick={() => handleProductClick(product)}
                                >
                                    <div className="product-image-container">
                                        <div className="image-wrapper">
                                            <img
                                                src={imageUrl}
                                                alt={product?.name || 'محصول'}
                                                className="product-image primary-image"
                                                onError={(e) => {
                                                    e.target.src = '/placeholder-product.png';
                                                }}
                                            />

                                            {hasMultipleImages && (
                                                <img
                                                    src={secondImageUrl}
                                                    alt={`${product?.name || 'محصول'} - تصویر دوم`}
                                                    className="product-image hover-image"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="product-info">
                                        <h3 className="product-name">{product?.name || 'بدون نام'}</h3>
                                    </div>
                                </NeoBrutalistCard>
                            );
                        })
                    ) : (
                        !loading && (
                            <div className="no-products">
                                <h2>هیچ محصولی یافت نشد</h2>
                                <p>لطفاً فیلترهای خود را تغییر دهید یا جستجوی دیگری انجام دهید</p>
                            </div>
                        )
                    )}
                </div>

                {/* SIMPLIFIED: Pagination controls */}
                {totalPages > 1 && (
                    <div className="pagination-container">
                        <div className="pagination-info">
                            <span>صفحه {currentPage} از {totalPages}</span>
                            <span>مجموع {totalProducts} محصول</span>
                        </div>

                        <div className="pagination-controls">
                            <button
                                className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                                onClick={() => handlePageChange(1)}
                                disabled={currentPage === 1 || loading}
                                title="صفحه اول"
                            >
                                <ChevronsRight size={18} />
                            </button>

                            <button
                                className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1 || loading}
                                title="صفحه قبل"
                            >
                                <ChevronRight size={18} />
                            </button>

                            <div className="pagination-numbers">
                                {getPageNumbers().map(pageNum => (
                                    <button
                                        key={pageNum}
                                        className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                                        onClick={() => handlePageChange(pageNum)}
                                        disabled={loading}
                                    >
                                        {pageNum}
                                    </button>
                                ))}
                            </div>

                            <button
                                className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages || loading}
                                title="صفحه بعد"
                            >
                                <ChevronLeft size={18} />
                            </button>

                            <button
                                className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                                onClick={() => handlePageChange(totalPages)}
                                disabled={currentPage === totalPages || loading}
                                title="صفحه آخر"
                            >
                                <ChevronsLeft size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal for product details */}
            <NeoBrutalistModal
                isOpen={!!selectedProduct}
                onClose={() => setSelectedProduct(null)}
                title=""
                size="large"
            >
                {selectedProduct && (
                    <div className="product-detail-modal" dir="rtl">
                        <div className="modal-header-section">
                            <h2>{selectedProduct.name || 'بدون نام'}</h2>
                            <div className={`modal-status-badge ${getStockStatus(selectedProduct).status}`}>
                                {getStockStatus(selectedProduct).text}
                            </div>
                        </div>

                        <div className="modal-main-content">
                            <div className="modal-product-images">
                                {(() => {
                                    const productImages = getProductImages(selectedProduct);
                                    if (productImages.length > 0) {
                                        const currentImage = productImages[currentImageIndex] || productImages[0];
                                        return (
                                            <div className="image-gallery">
                                                <img
                                                    src={currentImage.image_url || '/placeholder-product.png'}
                                                    alt={selectedProduct.name || 'محصول'}
                                                    className="modal-main-image"
                                                    onClick={() => handleImageClick(
                                                        currentImage.image_url,
                                                        selectedProduct.name,
                                                        currentImageIndex + 1
                                                    )}
                                                    onError={(e) => {
                                                        e.target.src = '/placeholder-product.png';
                                                    }}
                                                />
                                                {productImages.length > 1 && (
                                                    <div className="image-thumbnails">
                                                        {productImages.map((image, index) => (
                                                            <img
                                                                key={image.id || index}
                                                                src={image.image_url || '/placeholder-product.png'}
                                                                alt={`${selectedProduct.name} ${index + 1}`}
                                                                className={`thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                                                                onClick={() => setCurrentImageIndex(index)}
                                                                onError={(e) => e.target.src = '/placeholder-product.png'}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return <div>تصویر موجود نیست</div>;
                                })()}
                            </div>

                            <div className="modal-product-description">
                                <h4>توضیحات محصول:</h4>
                                <p>{selectedProduct.description || 'توضیحات موجود نیست'}</p>
                            </div>
                        </div>

                        <div className="modal-product-details">
                            <h4>مشخصات محصول</h4>
                            <div className="details-grid">
                                <div className="detail-item">
                                    <span className="detail-label">دسته‌بندی:</span>
                                    <span className="detail-value">
                                        {selectedProduct.category_name ||
                                            selectedProduct.category?.display_name ||
                                            selectedProduct.category?.name_fa ||
                                            selectedProduct.category?.name ||
                                            'نامشخص'}
                                    </span>
                                </div>

                                <div className="detail-item">
                                    <span className="detail-label">مبدا:</span>
                                    <span className="detail-value">
                                        {selectedProduct.origin_country || 'نامشخص'}
                                    </span>
                                </div>

                                <div className="detail-item">
                                    <span className="detail-label">نرخ مالیات:</span>
                                    <span className="detail-value">
                                        {formatTaxRate(selectedProduct.tax_rate)}
                                    </span>
                                </div>

                                <div className="detail-item">
                                    <span className="detail-label">وزن (کیلوگرم):</span>
                                    <span className="detail-value">
                                        {formatWeight(selectedProduct.weight)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            {!isDealer && getStockStatus(selectedProduct).status !== 'out_of_stock' && (
                                <NeoBrutalistButton
                                    text="ثبت سفارش"
                                    color="yellow-400"
                                    textColor="black"
                                    onClick={() => handleCreateOrder(selectedProduct)}
                                />
                            )}
                            <NeoBrutalistButton
                                text="بستن"
                                color="gray-400"
                                textColor="black"
                                onClick={() => setSelectedProduct(null)}
                            />
                        </div>
                    </div>
                )}
            </NeoBrutalistModal>

            {/* Fullscreen image modal */}
            {fullscreenImage && (
                <div className="fullscreen-image-overlay" onClick={handleFullscreenClose}>
                    <button className="fullscreen-close-btn" onClick={handleFullscreenClose}>✕</button>
                    <img
                        src={fullscreenImage.url || '/placeholder-product.png'}
                        alt={fullscreenImage.productName || 'محصول'}
                        className="fullscreen-image"
                        onClick={(e) => e.stopPropagation()}
                        onError={(e) => e.target.src = '/placeholder-product.png'}
                    />
                </div>
            )}
        </div>
    );
};

export default ProductsPage;