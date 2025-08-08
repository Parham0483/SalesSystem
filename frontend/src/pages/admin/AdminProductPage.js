import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Package, Search, Filter, Eye, Edit, ShoppingCart, TrendingUp,
    AlertTriangle, CheckCircle, XCircle, Plus, Download, Star,
    BarChart3, DollarSign, Archive, RefreshCw
} from 'lucide-react';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistDropdown from '../../component/NeoBrutalist/NeoBrutalistDropdown';
import NeoBrutalistToggle from '../../component/NeoBrutalist/NeoBrutalistToggle';
import API from '../../component/api';
import '../../styles/Admin/AdminProducts.css';

const AdminProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState('');

    const formatPrice = (price) => {
        if (!price || price === 0) return 'تماس بگیرید';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
    };

    // Form State
    const [productFormData, setProductFormData] = useState({
        name: '',
        description: '',
        category: null,
        origin: '',
        base_price: 0,
        tax_price: 10.00,
        stock: 0,
        is_active: true,
        is_featured: false,
        weight: 0,
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');

    // Filtering and Sorting State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');

    // Bulk Actions
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [showBulkActions, setShowBulkActions] = useState(false);

    // Stats
    const [productStats, setProductStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        lowStock: 0,
        outOfStock: 0,
        featured: 0,
        totalValue: 0
    });

    // Categories for filter
    const [categories, setCategories] = useState([]);

    const navigate = useNavigate();

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/products/');
            setProducts(response.data);
            calculateStats(response.data);
            //extractCategories(response.data);
            setError('');
        } catch (err) {
            console.error('❌ Error fetching products:', err);
            if (err.response?.status === 401) {
                setError('نشست شما منقضی شده است. در حال انتقال به صفحه ورود...');
                setTimeout(() => handleLogout(), 2000);
            } else {
                setError('خطا در بارگیری لیست محصولات');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, [fetchProducts]);

    const calculateStats = (productsList) => {

        const totalValue = productsList.reduce((sum, p) => {
            // Convert to numbers and handle null/undefined values
            const price = parseFloat(p.base_price) || 0;
            const stock = parseInt(p.stock) || 0;
            const productValue = price * stock;

            // Debug individual product values
            if (productValue > 0) {
            }
            return sum + productValue;
        }, 0);


        const stats = {
            total: productsList.length,
            active: productsList.filter(p => p.is_active).length,
            inactive: productsList.filter(p => !p.is_active).length,
            lowStock: productsList.filter(p => p.stock > 0 && p.stock <= 50).length,
            outOfStock: productsList.filter(p => p.stock === 0).length,
            featured: productsList.filter(p => p.is_featured).length,
            totalValue: totalValue
        };

        setProductStats(stats);
    };


    const formatTotalValue = (value) => {
        if (value >= 1000000000) {
            return `${(value / 1000000000).toFixed(1)}B`;
        } else if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}K`;
        } else {
            return value.toLocaleString('fa-IR');
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await API.get('/admin/products/categories/');
            setCategories(response.data);
        } catch (err) {
            console.error('❌ Error fetching categories:', err);
            setCategories([
                { id: 1, name: 'Coffee Related', display_name: 'محصولات قهوه' },
                { id: 2, name: 'Seeds', display_name: 'دانه‌ها' },
                { id: 3, name: 'Spices', display_name: 'ادویه‌جات' },
                { id: 4, name: 'Nuts', display_name: 'آجیل' },
                { id:5, name:'Confectionery products', display_name: 'محصولات قنادی' }
            ]);
        }
    };

    useEffect(() => {
        let filtered = [...products];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(p =>
                p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.category?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(p => p.is_active === (statusFilter === 'active'));
        }

        // Stock filter
        if (stockFilter !== 'all') {
            filtered = filtered.filter(p => {
                if (stockFilter === 'out_of_stock') return p.stock === 0;
                if (stockFilter === 'low_stock') return p.stock > 0 && p.stock <= 50;
                if (stockFilter === 'in_stock') return p.stock > 10;
                return true;
            });
        }

        // Category filter
        if (categoryFilter !== 'all' && categoryFilter !== '') {
            filtered = filtered.filter(p => {
                // Handle both cases: category as ID or as object
                const productCategoryId = typeof p.category === 'object' ? p.category?.id : p.category;
                return productCategoryId === parseInt(categoryFilter);
            });
        }


        // Sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                case 'oldest':
                    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
                case 'name':
                    return a.name.localeCompare(b.name, 'fa');
                case 'price':
                    return b.base_price - a.base_price;
                case 'stock':
                    return b.stock - a.stock;
                default:
                    return 0;
            }
        });

        setFilteredProducts(filtered);
    }, [products, searchTerm, statusFilter, stockFilter, categoryFilter, sortBy]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    const handleOpenModal = (product = null) => {
        setEditingProduct(product);
        if (product) {
            setProductFormData({ ...product });
            setImagePreview(product.image_url || '');
        } else {
            setProductFormData({
                name: '',
                description: '',
                category: null,
                origin: '',
                base_price: 0,
                tax_rate: 10.00,
                stock: 0,
                is_active: true,
                is_featured: false,
                weight: 0,
            });
            setImagePreview('');
        }
        setImageFile(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
        setProductFormData({});
        setImageFile(null);
        setImagePreview('');
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setProductFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked :
                name === 'category' ? (value ? parseInt(value, 10) : null) :
                    value
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            if (!allowedTypes.includes(file.type)) {
                setError('فرمت فایل پشتیبانی نمی‌شود. لطفا فایل JPEG، PNG، GIF یا WebP انتخاب کنید.');
                e.target.value = ''; // Clear the input
                return;
            }

            if (file.size > maxSize) {
                setError('حجم فایل نباید بیشتر از 5 مگابایت باشد.');
                e.target.value = ''; // Clear the input
                return;
            }

            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(''); // Clear any previous errors
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();

        // List of fields to exclude when sending to backend
        const excludeFields = ['image_url', 'id', 'created_at', 'updated_at', 'stock_status', 'is_out_of_stock', 'days_since_created', 'category_name', 'category_details'];

        // Add only the fields that should be sent to backend
        Object.keys(productFormData).forEach(key => {
            if (!excludeFields.includes(key) && productFormData[key] !== null && productFormData[key] !== undefined) {
                // Handle category field specially - ensure it's a number or null
                if (key === 'category') {
                    const categoryValue = productFormData[key];
                    if (categoryValue !== null && categoryValue !== '') {
                        formData.append(key, parseInt(categoryValue, 10));
                    }
                } else {
                    formData.append(key, productFormData[key]);
                }
            }
        });

        // Only append image if a new file was selected
        if (imageFile) {
            formData.append('image', imageFile);
        }

        const url = editingProduct ? `/admin/products/${editingProduct.id}/` : '/admin/products/';
        const method = editingProduct ? 'patch' : 'post';

        try {

            const response = await API[method](url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            fetchProducts();
            handleCloseModal();
        } catch (err) {
            console.error('❌ Error saving product:', err.response?.data);
            setError(`خطا در ذخیره محصول: ${JSON.stringify(err.response?.data)}`);
        }
    };

    const handleToggleStatus = async (product) => {
        try {
            await API.patch(`/admin/products/${product.id}/`, { is_active: !product.is_active });
            fetchProducts();
        } catch (err) {
            console.error('Error toggling status', err);
            setError('خطا در تغییر وضعیت محصول');
        }
    };

    const handleToggleFeatured = async (product) => {
        try {
            await API.patch(`/admin/products/${product.id}/`, { is_featured: !product.is_featured });
            fetchProducts();
        } catch (err) {
            console.error('Error toggling featured status', err);
            setError('خطا در تغییر وضعیت ویژه محصول');
        }
    };

    const handleDeleteProduct = async (productId) => {
        if (window.confirm('آیا از حذف این محصول اطمینان دارید؟ این عمل غیرقابل بازگشت است.')) {
            try {
                await API.delete(`/admin/products/${productId}/`);
                fetchProducts();
            } catch (err) {
                console.error('Error deleting product', err);
                setError('خطا در حذف محصول');
            }
        }
    };

    const handleQuickStockUpdate = async (productId, newStock) => {
        const stock = parseInt(newStock, 10);
        if (isNaN(stock) || stock < 0) {
            alert("لطفا یک عدد معتبر برای موجودی وارد کنید.");
            return;
        }
        try {
            await API.patch(`/admin/products/${productId}/`, { stock });
            fetchProducts();
        } catch(err) {
            console.error('Error updating stock', err);
            setError('خطا در به‌روزرسانی موجودی');
        }
    };

    const handleProductSelect = (productId) => {
        setSelectedProducts(prev => {
            const newSelection = prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId];
            setShowBulkActions(newSelection.length > 0);
            return newSelection;
        });
    };

    const handleSelectAll = () => {
        if (selectedProducts.length === filteredProducts.length) {
            setSelectedProducts([]);
            setShowBulkActions(false);
        } else {
            const allIds = filteredProducts.map(p => p.id);
            setSelectedProducts(allIds);
            setShowBulkActions(true);
        }
    };

    const handleBulkAction = async (action) => {
        try {
            await API.post('/admin/products/bulk-action/', {
                action,
                product_ids: selectedProducts
            });
            fetchProducts();
            setSelectedProducts([]);
            setShowBulkActions(false);
        } catch (err) {
            console.error('Error performing bulk action', err);
            setError('خطا در انجام عملیات گروهی');
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setStockFilter('all');
        setCategoryFilter('all');
        setSortBy('newest');
    };

    const getStockStatus = (stock) => {
        if (stock === 0) return { status: 'out', label: 'ناموجود', color: 'red' };
        if (stock <= 50) return { status: 'low', label: 'موجودی کم', color: 'yellow' };
        return { status: 'ok', label: 'موجود', color: 'green' };
    };

    const statusOptions = [
        { value: 'all', label: 'همه وضعیت‌ها' },
        { value: 'active', label: 'فعال' },
        { value: 'inactive', label: 'غیرفعال' }
    ];

    const stockOptions = [
        { value: 'all', label: 'همه موجودی‌ها' },
        { value: 'in_stock', label: 'موجود' },
        { value: 'low_stock', label: 'موجودی کم' },
        { value: 'out_of_stock', label: 'ناموجود' }
    ];

    const categoryOptions = [
        { value: 'all', label: 'همه دسته‌ها' }, // Change empty string to 'all'
        ...categories.map(cat => ({
            value: cat.id,
            label: cat.display_name || cat.name
        }))
    ];

    const sortOptions = [
        { value: 'newest', label: 'جدیدترین' },
        { value: 'oldest', label: 'قدیمی‌ترین' },
        { value: 'name', label: 'نام' },
        { value: 'price', label: 'قیمت' },
        { value: 'stock', label: 'موجودی' }
    ];

    if (loading) {
        return (
            <div className="admin-products-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>در حال بارگیری محصولات...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-products-page" dir="rtl">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="page-title">
                            <Package className="title-icon" />
                            مدیریت محصولات
                        </h1>
                        <p className="page-subtitle">
                            {filteredProducts.length} محصول از مجموع {products.length} محصول
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="+ افزودن محصول جدید"
                            color="green-400"
                            textColor="black"
                            onClick={() => handleOpenModal()}
                        />
                        <NeoBrutalistButton
                            text="داشبورد"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/admin')}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {/* Statistics Cards */}
            <div className="stats-section">
                <div className="stats-grid">
                    <NeoBrutalistCard className="stat-card total" onClick={() => { setStatusFilter('all'); setStockFilter('all'); }}>
                        <div className="stat-content">
                            <Package className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{productStats.total}</span>
                                <span className="stat-label">کل محصولات</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card active" onClick={() => setStatusFilter('active')}>
                        <div className="stat-content">
                            <CheckCircle className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{productStats.active}</span>
                                <span className="stat-label">فعال</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card warning" onClick={() => setStockFilter('low_stock')}>
                        <div className="stat-content">
                            <AlertTriangle className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{productStats.lowStock}</span>
                                <span className="stat-label">موجودی کم</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>


                    <NeoBrutalistCard className="stat-card value">
                        <div className="stat-content">
                            <DollarSign className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{formatTotalValue(productStats.totalValue)}</span>
                                <span className="stat-label">ارزش کل موجودی</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>
                </div>
            </div>

            {/* Filters Section */}
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
                        label="وضعیت"
                        options={statusOptions}
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                    />

                    <NeoBrutalistDropdown
                        label="موجودی"
                        options={stockOptions}
                        value={stockFilter}
                        onChange={(value) => setStockFilter(value)}
                    />

                    <NeoBrutalistDropdown
                        label="دسته‌بندی"
                        options={categoryOptions}
                        value={categoryFilter}
                        onChange={(value) => setCategoryFilter(value)}
                    />

                    <NeoBrutalistDropdown
                        label="مرتب‌سازی"
                        options={sortOptions}
                        value={sortBy}
                        onChange={(value) => setSortBy(value)}
                    />
                </div>

                {/* Bulk Actions */}
                {showBulkActions && (
                    <div className="bulk-actions">
                        <span>{selectedProducts.length} محصول انتخاب شده</span>
                        <div className="bulk-buttons">
                            <NeoBrutalistButton
                                text="فعال کردن"
                                color="green-400"
                                textColor="black"
                                onClick={() => handleBulkAction('activate')}
                            />
                            <NeoBrutalistButton
                                text="غیرفعال کردن"
                                color="red-400"
                                textColor="white"
                                onClick={() => handleBulkAction('deactivate')}
                            />
                            <NeoBrutalistButton
                                text="حذف گروهی"
                                color="red-400"
                                textColor="white"
                                onClick={() => handleBulkAction('delete')}
                            />
                        </div>
                    </div>
                )}
            </NeoBrutalistCard>

            {/* Products Header */}
            <NeoBrutalistCard className="table-header">
                <div className="table-header-content">
                    <label className="select-all-wrapper">
                        <input
                            type="checkbox"
                            checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                            onChange={handleSelectAll}
                        />
                        انتخاب همه
                    </label>
                    <span>نمایش {filteredProducts.length} محصول</span>
                    <div className="view-toggles">
                        <NeoBrutalistButton
                            text="📋 لیست"
                            color="blue-400"
                            textColor="white"
                        />
                    </div>
                </div>
            </NeoBrutalistCard>

            {/* Products Grid */}
            <div className="products-grid">
                {filteredProducts.map(product => {
                    const stockStatus = getStockStatus(product.stock);
                    return (
                        <NeoBrutalistCard
                            key={product.id}
                            className={`product-card ${!product.is_active ? 'inactive' : ''} ${product.is_featured ? 'featured' : ''}`}
                        >
                            <div className="card-header">
                                <label className="product-select">
                                    <input
                                        type="checkbox"
                                        checked={selectedProducts.includes(product.id)}
                                        onChange={() => handleProductSelect(product.id)}
                                    />
                                </label>

                                <div className="product-image">
                                    <img
                                        src={product.image_url || 'https://placehold.co/120x120/e2e8f0/a0aec0?text=No+Image'}
                                        alt={product.name}
                                        onClick={() => {
                                            setSelectedImage(product.image_url);
                                            setIsImageModalOpen(true);
                                        }}
                                    />
                                    {product.is_featured && (
                                        <div className="featured-badge">
                                            <Star size={16} />
                                        </div>
                                    )}
                                </div>

                                <div className="product-tags">
                                    <span className={`tag status-tag ${product.is_active ? 'active' : 'inactive'}`}>
                                        {product.is_active ? (
                                            <><CheckCircle size={12} /> فعال</>
                                        ) : (
                                            <><XCircle size={12} /> غیرفعال</>
                                        )}
                                    </span>
                                    <span className={`tag stock-tag ${stockStatus.status}`}>
                                        {stockStatus.label}
                                    </span>
                                </div>
                            </div>

                            <div className="product-info">
                                <h3 className="product-name">{product.name}</h3>
                                {product.category && (
                                    <span className="product-category">{product.category}</span>
                                )}
                                <p className="product-description">
                                    {product.description?.substring(0, 100)}...
                                </p>
                            </div>

                            <div className="product-details">
                                <div className="detail-row">
                                    <span className="detail-label">قیمت پایه:</span>
                                    <span className="detail-value price">
                                        {product.base_price.toLocaleString('fa-IR')} ریال
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">نرخ مالیات:</span>
                                    <span className="detail-value tax-rate">
                                        {product.tax_rate ? `${parseFloat(product.tax_rate).toFixed(1)}%` : '0%'}
                                    </span>
                                </div>
                                {product.tax_rate && product.tax_rate > 0 && (
                                    <div className="detail-row">
                                        <span className="detail-label">قیمت با مالیات:</span>
                                        <span className="detail-value price-with-tax">
                                            {(product.base_price * (1 + product.tax_rate / 100)).toLocaleString('fa-IR')} ریال
                                        </span>
                                    </div>
                                )}
                                <div className="detail-row">
                                    <span className="detail-label">موجودی:</span>
                                    <span className="detail-value price">
                                        {product.stock.toLocaleString()}
                                    </span>

                                </div>
                                {product.origin && (
                                    <div className="detail-row">
                                        <span className="detail-label">مبدا:</span>
                                        <span className="detail-value">{product.origin}</span>
                                    </div>
                                )}
                            </div>

                            <div className="product-actions">
                                <div className="toggle-actions">
                                    <NeoBrutalistToggle
                                        checked={product.is_active}
                                        onChange={() => handleToggleStatus(product)}
                                        label="فعال"
                                    />
                                    <NeoBrutalistToggle
                                        checked={product.is_featured}
                                        onChange={() => handleToggleFeatured(product)}
                                        label="ویژه"
                                    />
                                </div>
                                <div className="action-buttons">
                                    <NeoBrutalistButton
                                        text="ویرایش"
                                        color="blue-400"
                                        textColor="white"
                                        onClick={() => handleOpenModal(product)}
                                    />
                                    <NeoBrutalistButton
                                        text="حذف"
                                        color="red-400"
                                        textColor="white"
                                        onClick={() => handleDeleteProduct(product.id)}
                                    />
                                </div>
                            </div>
                        </NeoBrutalistCard>
                    );
                })}
            </div>

            {/* Empty State */}
            {filteredProducts.length === 0 && !loading && (
                <NeoBrutalistCard className="empty-state-card">
                    <div className="empty-content">
                        <Package size={48} className="empty-icon" />
                        <h3>محصولی یافت نشد</h3>
                        <p>
                            {products.length === 0
                                ? 'هنوز محصولی ثبت نشده است.'
                                : 'بر اساس فیلترهای انتخاب شده، محصولی یافت نشد.'
                            }
                        </p>
                        {products.length > 0 && (
                            <NeoBrutalistButton
                                text="پاک کردن فیلترها"
                                color="blue-400"
                                textColor="white"
                                onClick={clearFilters}
                            />
                        )}
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Product Modal */}
            <NeoBrutalistModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingProduct ? 'ویرایش محصول' : 'افزودن محصول جدید'}
                size="large"
            >
                <form onSubmit={handleFormSubmit} className="product-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>نام محصول</label>
                            <NeoBrutalistInput
                                name="name"
                                value={productFormData.name || ''}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>دسته‌بندی</label>
                            <NeoBrutalistDropdown
                                label=""
                                options={categoryOptions}
                                value={productFormData.category || ''}
                                onChange={(value) => setProductFormData(prev => ({
                                    ...prev,
                                    category: value ? parseInt(value, 10) : null
                                }))}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>توضیحات</label>
                        <textarea
                            name="description"
                            value={productFormData.description || ''}
                            onChange={handleFormChange}
                            rows="4"
                            className="form-textarea"
                            placeholder="توضیحات کامل محصول..."
                        ></textarea>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>موجودی اولیه</label>
                            <NeoBrutalistInput
                                type="number"
                                name="stock"
                                value={productFormData.stock || 0}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>قیمت پایه (ریال)</label>
                            <NeoBrutalistInput
                                type="number"
                                name="base_price"
                                value={productFormData.base_price || 0}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                    </div>


                    <div className="form-row">
                        <div className="form-group">
                            <label>مبدا</label>
                            <NeoBrutalistInput
                                name="origin"
                                value={productFormData.origin || ''}
                                onChange={handleFormChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>وزن (کیلوگرم)</label>
                            <NeoBrutalistInput
                                type="number"
                                step="0.1"
                                name="weight"
                                value={productFormData.weight || 0}
                                onChange={handleFormChange}
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>نرخ مالیات (%)</label>
                            <NeoBrutalistInput
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                name="tax_rate"
                                value={productFormData.tax_rate || 0}
                                onChange={handleFormChange}
                                placeholder="9.00"
                            />
                            <small className="form-help-text">
                                نرخ مالیات این محصول به درصد (مثال: 10.00 برای 10٪)
                            </small>
                        </div>

                        {productFormData.base_price > 0 && productFormData.tax_rate > 0 && (
                            <div className="form-group">
                                <label>پیش‌نمایش قیمت با مالیات</label>
                                <div className="price-preview">
                                    <span className="preview-base">قیمت پایه: {formatPrice(productFormData.base_price)}</span>
                                    <span className="preview-tax">
                                        مالیات ({productFormData.tax_rate}%): {formatPrice(productFormData.base_price * productFormData.tax_rate / 100)}
                                    </span>
                                    <span className="preview-total">
                    قیمت نهایی:                  {formatPrice(productFormData.base_price * (1 + productFormData.tax_rate / 100))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>تصویر محصول</label>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept="image/*"
                            className="file-input"
                        />
                        {imagePreview && (
                            <div className="image-preview-container">
                                <img src={imagePreview} alt="Preview" className="image-preview" />
                            </div>
                        )}
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <NeoBrutalistToggle
                                checked={productFormData.is_active || false}
                                onChange={(e) => setProductFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                label="محصول فعال باشد"
                            />
                        </div>
                        <div className="form-group">
                            <NeoBrutalistToggle
                                checked={productFormData.is_featured || false}
                                onChange={(e) => setProductFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                                label="محصول ویژه"
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <NeoBrutalistButton
                            text="لغو"
                            color="gray-400"
                            textColor="black"
                            onClick={handleCloseModal}
                            type="button"
                        />
                        <NeoBrutalistButton
                            text="ذخیره تغییرات"
                            color="green-400"
                            textColor="black"
                            type="submit"
                        />
                    </div>
                </form>
            </NeoBrutalistModal>

            {/* Image Modal */}
            <NeoBrutalistModal
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                title="نمایش تصویر"
                size="medium"
            >
                <div className="image-modal-content">
                    <img src={selectedImage} alt="Product" className="modal-image" />
                </div>
            </NeoBrutalistModal>
        </div>
    );
};

export default AdminProductsPage;