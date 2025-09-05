import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api';
import { useAuth } from '../../hooks/useAuth';
import LazyImage from '../../component/LazyImage';
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
    const [sortBy, setSortBy] = useState('newest');
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
    const [productsPerPage, setProductsPerPage] = useState(9);
    const [totalPages, setTotalPages] = useState(0);

    // Hooks
    const navigate = useNavigate();
    const { isDealer = false } = useAuth();

    // Calculate pagination info
    const startIndex = (currentPage - 1) * productsPerPage + 1;
    const endIndex = Math.min(currentPage * productsPerPage, totalProducts);

    // SIMPLIFIED IMAGE HANDLING
    const getImageUrl = (product, preferThumbnail = false) => {
        if (!product) return '/placeholder-product.png';

        // Direct thumbnail URL if available and requested
        if (preferThumbnail && product.thumbnail_url) {
            console.log('Using thumbnail_url:', product.thumbnail_url);
            return product.thumbnail_url;
        }

        // Primary image URL
        if (product.primary_image_url) {
            console.log('Using primary_image_url:', product.primary_image_url);
            return product.primary_image_url;
        }

        // Fallback to basic image_url
        if (product.image_url) {
            console.log('Using image_url:', product.image_url);
            return product.image_url;
        }

        // Last resort - check product_images array
        if (product.product_images && product.product_images.length > 0) {
            const firstImage = product.product_images[0];
            if (firstImage.image_url || firstImage.image) {
                const imageUrl = firstImage.image_url || firstImage.image;
                console.log('Using product_images[0]:', imageUrl);
                return imageUrl;
            }
        }

        console.log('No valid image found, using placeholder');
        return '/placeholder-product.png';
    };

    const getSecondImageUrl = (product) => {
        if (!product) return null;
        if (product.product_images && product.product_images.length > 1) {
            const secondImage = product.product_images[1];
            return secondImage.image_url || secondImage.image;
        }
        return null;
    };

    const getProductImages = (product) => {
        if (!product) return [];

        let images = [];

        // Get images from product_images array
        if (product.product_images && product.product_images.length > 0) {
            images = product.product_images.map(img => ({
                id: img.id || Math.random(),
                image_url: img.image_url || img.image,
                is_primary: img.is_primary || false,
                alt_text: img.alt_text || ''
            }));
        }

        // If no product_images, try to construct from primary/thumbnail URLs
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

        console.log(`Product ${product.name} images:`, images);
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
        setSortBy('newest');
        setCurrentPage(1);
    };

    const handleProductClick = (product) => {
        console.log('Product clicked:', product);
        setSelectedProduct(product);
    };

    const handleImageClick = (imageUrl, productName, imageIndex = null) => {
        console.log('Image clicked:', { imageUrl, productName, imageIndex });
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

    // Pagination handlers
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleProductsPerPageChange = (newPerPage) => {
        setProductsPerPage(newPerPage);
        setCurrentPage(1); // Reset to first page
    };

    // API functions
    const fetchProducts = async (page = currentPage, limit = productsPerPage) => {
        try {
            setLoading(true);
            setError('');

            const offset = (page - 1) * limit;
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });

            // Add filters
            if (searchTerm) {
                params.append('search', searchTerm);
            }
            if (selectedCategory && selectedCategory !== 'all') {
                params.append('category', selectedCategory);
            }
            if (filterStatus && filterStatus !== 'all') {
                params.append('status', filterStatus);
            }
            if (sortBy) {
                params.append('ordering', sortBy);
            }

            console.log('Fetching products with params:', params.toString());

            const response = await API.get(`/products/?${params.toString()}`);
            console.log('Products API response:', response.data);

            const data = response.data;
            setProducts(data.results || []);
            setTotalProducts(data.count || 0);
            setTotalPages(Math.ceil((data.count || 0) / limit));

        } catch (err) {
            console.error('Error fetching products:', err);
            setError('خطا در بارگیری محصولات');
            setProducts([]);
            setTotalProducts(0);
            setTotalPages(0);
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await API.get('/categories/');
            console.log('Categories API response:', response.data);
            setCategories(response.data || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
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
            value: cat?.id || cat?.name,
            label: cat?.display_name || cat?.name || 'بدون نام'
        }))
    ];



    // Effects
    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            console.log('Filters changed, fetching products...');
            fetchProducts(1, productsPerPage); // Always start from page 1 when filters change
            if (currentPage !== 1) {
                setCurrentPage(1);
            }
        }, 500);
        return () => clearTimeout(debounceTimer);
    }, [searchTerm, selectedCategory, filterStatus, sortBy, productsPerPage]);

    useEffect(() => {
        fetchProducts(currentPage, productsPerPage);
    }, [currentPage]);

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
                        onClick={() => fetchProducts(currentPage, productsPerPage)}
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
                <div className="filters-grid">
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
                            console.log(`Product ${product.id || index} card image:`, imageUrl);

                            return (
                                <NeoBrutalistCard
                                    key={product?.id || `product-${index}`}
                                    className="product-card"
                                    onClick={() => handleProductClick(product)}
                                >
                                    <div className="product-image-container">
                                        <div className="image-wrapper">
                                            {/* Primary Image */}
                                            <img
                                                src={imageUrl}
                                                alt={product?.name || 'محصول'}
                                                className="product-image primary-image"
                                                onError={(e) => {
                                                    console.error(`Product ${product.id} primary image failed:`, e.target.src);
                                                    e.target.src = '/placeholder-product.png';
                                                }}
                                                onLoad={() => console.log(`Product ${product.id} primary image loaded`)}
                                            />

                                            {/* Second Image - Shows on Hover */}
                                            {getSecondImageUrl(product) && (
                                                <img
                                                    src={getSecondImageUrl(product)}
                                                    alt={`${product?.name || 'محصول'} - تصویر دوم`}
                                                    className="product-image hover-image"
                                                    onError={(e) => {
                                                        console.error(`Product ${product.id} hover image failed:`, e.target.src);
                                                        e.target.style.display = 'none';
                                                    }}
                                                    onLoad={() => console.log(`Product ${product.id} hover image loaded`)}
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

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="pagination-container">
                        <div className="pagination-info">
                            <span>صفحه {currentPage} از {totalPages}</span>
                            <span>مجموع {totalProducts} محصول</span>
                        </div>

                        <div className="pagination-controls">
                            {/* First Page */}
                            <button
                                className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                                onClick={() => handlePageChange(1)}
                                disabled={currentPage === 1}
                                title="صفحه اول"
                            >
                                <ChevronsRight size={18} />
                            </button>

                            {/* Previous Page */}
                            <button
                                className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                title="صفحه قبل"
                            >
                                <ChevronRight size={18} />
                            </button>

                            {/* Page Numbers */}
                            <div className="pagination-numbers">
                                {getPageNumbers().map(pageNum => (
                                    <button
                                        key={pageNum}
                                        className={`pagination-number ${currentPage === pageNum ? 'active' : ''}`}
                                        onClick={() => handlePageChange(pageNum)}
                                    >
                                        {pageNum}
                                    </button>
                                ))}
                            </div>

                            {/* Next Page */}
                            <button
                                className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                title="صفحه بعد"
                            >
                                <ChevronLeft size={18} />
                            </button>

                            {/* Last Page */}
                            <button
                                className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                                onClick={() => handlePageChange(totalPages)}
                                disabled={currentPage === totalPages}
                                title="صفحه آخر"
                            >
                                <ChevronsLeft size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* SIMPLIFIED MODAL */}
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
                                                        console.error('Modal image failed:', e.target.src);
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

            {/* SIMPLIFIED FULLSCREEN */}
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