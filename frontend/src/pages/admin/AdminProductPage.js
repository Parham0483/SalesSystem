import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Package, Search, Filter, Eye, Edit, ShoppingCart, TrendingUp,
    AlertTriangle, CheckCircle, XCircle, Plus, Download, Star,
    BarChart3, DollarSign, Archive, RefreshCw, ChevronLeft, ChevronRight,
    Trash2, GripVertical, Move, ArrowUp, ArrowDown
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
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [productImages, setProductImages] = useState([]);

    // Drag & Drop States
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [draggedOver, setDraggedOver] = useState(null);
    const [imageOrder, setImageOrder] = useState([]); // Track image display order
    const dragCounter = useRef(0);

    const formatPrice = (price) => {
        if (!price || price === 0) return 'تماس بگیرید';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
    };

    // Form State with image ordering
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
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreview, setImagePreview] = useState('');
    const [imagePreviews, setImagePreviews] = useState([]);
    const [existingImages, setExistingImages] = useState([]);

    // Enhanced image structure with metadata
    const [orderedImages, setOrderedImages] = useState([]); // { src, id, type: 'existing'|'new', file?, order }

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
            setError('');
        } catch (err) {
            console.error('Error fetching products:', err);
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
            const price = parseFloat(p.base_price) || 0;
            const stock = parseInt(p.stock) || 0;
            const productValue = price * stock;
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
            console.error('Error fetching categories:', err);
            setCategories([
                { id: 1, name: 'Coffee Related', display_name: 'محصولات قهوه' },
                { id: 2, name: 'Seeds', display_name: 'دانه‌ها' },
                { id: 3, name: 'Spices', display_name: 'ادویه‌جات' },
                { id: 4, name: 'Nuts', display_name: 'آجیل' },
                { id: 5, name: 'Confectionery products', display_name: 'محصولات قنادی' }
            ]);
        }
    };

    // Drag & Drop Functions
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
        e.target.style.opacity = '0.4';
        dragCounter.current = 0;
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        setDraggedIndex(null);
        setDraggedOver(null);
        dragCounter.current = 0;
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragEnter = (e, index) => {
        e.preventDefault();
        dragCounter.current++;
        setDraggedOver(index);
    };

    const handleDragLeave = (e) => {
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setDraggedOver(null);
        }
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === dropIndex) return;

        const newOrderedImages = [...orderedImages];
        const draggedImage = newOrderedImages[draggedIndex];

        // Remove dragged item and insert at new position
        newOrderedImages.splice(draggedIndex, 1);
        newOrderedImages.splice(dropIndex, 0, draggedImage);

        // Update order property
        newOrderedImages.forEach((img, idx) => {
            img.order = idx;
        });

        setOrderedImages(newOrderedImages);
        setDraggedIndex(null);
        setDraggedOver(null);
        dragCounter.current = 0;
    };

    const moveImageUp = (index) => {
        if (index === 0) return;
        const newOrderedImages = [...orderedImages];
        [newOrderedImages[index - 1], newOrderedImages[index]] =
            [newOrderedImages[index], newOrderedImages[index - 1]];

        // Update order property
        newOrderedImages.forEach((img, idx) => {
            img.order = idx;
        });

        setOrderedImages(newOrderedImages);
    };

    const moveImageDown = (index) => {
        if (index === orderedImages.length - 1) return;
        const newOrderedImages = [...orderedImages];
        [newOrderedImages[index], newOrderedImages[index + 1]] =
            [newOrderedImages[index + 1], newOrderedImages[index]];

        // Update order property
        newOrderedImages.forEach((img, idx) => {
            img.order = idx;
        });

        setOrderedImages(newOrderedImages);
    };

    const getCategoryDisplayName = (product) => {
        if (!product.category) return null;
        if (typeof product.category === 'object' && product.category.display_name) {
            return product.category.display_name;
        }
        if (typeof product.category === 'object' && product.category.name) {
            return product.category.name;
        }
        if (typeof product.category === 'number') {
            const categoryObj = categories.find(cat => cat.id === product.category);
            return categoryObj ? (categoryObj.display_name || categoryObj.name) : `دسته ${product.category}`;
        }
        if (typeof product.category === 'string') {
            return product.category;
        }
        return null;
    };

    const getCategoryClass = (product) => {
        const categoryName = getCategoryDisplayName(product);
        if (!categoryName) return '';

        const categoryMap = {
            'محصولات قهوه': 'admin-category-coffee',
            'دانه‌ها': 'admin-category-seeds',
            'ادویه‌جات': 'admin-category-spices',
            'آجیل': 'admin-category-nuts',
            'محصولات قنادی': 'admin-category-confectionery'
        };

        return categoryMap[categoryName] || 'admin-category-default';
    };

    // Add state for card image navigation
    const [cardImageIndices, setCardImageIndices] = useState({});

    // Card image navigation functions
    const getProductImages = (product) => {
        const images = [];

        // Add main product image if exists
        if (product.image_url || product.image) {
            images.push(product.image_url || product.image);
        }

        // Add images from ProductImage model
        if (product.product_images && Array.isArray(product.product_images)) {
            images.push(...product.product_images.map(img => img.image));
        }

        // Remove duplicates and empty values
        return [...new Set(images.filter(img => img))];
    };

    const nextCardImage = (productId, e) => {
        e.stopPropagation();
        const product = products.find(p => p.id === productId);
        const images = getProductImages(product);

        if (images.length > 1) {
            setCardImageIndices(prev => {
                const currentIndex = prev[productId] || 0;
                const nextIndex = (currentIndex + 1) % images.length;
                return { ...prev, [productId]: nextIndex };
            });
        }
    };

    const prevCardImage = (productId, e) => {
        e.stopPropagation();
        const product = products.find(p => p.id === productId);
        const images = getProductImages(product);

        if (images.length > 1) {
            setCardImageIndices(prev => {
                const currentIndex = prev[productId] || 0;
                const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
                return { ...prev, [productId]: prevIndex };
            });
        }
    };

    const getCurrentCardImage = (product) => {
        const images = getProductImages(product);
        const currentIndex = cardImageIndices[product.id] || 0;
        return images[currentIndex] || images[0] || 'https://placehold.co/400x200/e2e8f0/a0aec0?text=No+Image';
    };

    // Image navigation functions
    const openImageModal = (product) => {
        // Create array of all product images based on your backend structure
        const images = [];

        // Add main product image if exists
        if (product.image_url || product.image) {
            images.push(product.image_url || product.image);
        }

        // Add images from ProductImage model (your backend structure)
        if (product.product_images && Array.isArray(product.product_images)) {
            images.push(...product.product_images.map(img => img.image));
        }

        // Fallback: check for images array (different backend structures)
        if (product.images && Array.isArray(product.images)) {
            images.push(...product.images.map(img => img.url || img.image || img));
        }

        // Additional images field
        if (product.additional_images && Array.isArray(product.additional_images)) {
            images.push(...product.additional_images.map(img => img.url || img.image || img));
        }

        // Remove duplicates and empty values
        const uniqueImages = [...new Set(images.filter(img => img))];

        setProductImages(uniqueImages);
        setCurrentImageIndex(0);
        setSelectedImage(uniqueImages[0] || '');
        setIsImageModalOpen(true);
    };

    const nextImage = () => {
        if (productImages.length > 1) {
            const nextIndex = (currentImageIndex + 1) % productImages.length;
            setCurrentImageIndex(nextIndex);
            setSelectedImage(productImages[nextIndex]);
        }
    };

    const prevImage = () => {
        if (productImages.length > 1) {
            const prevIndex = currentImageIndex === 0 ? productImages.length - 1 : currentImageIndex - 1;
            setCurrentImageIndex(prevIndex);
            setSelectedImage(productImages[prevIndex]);
        }
    };

    const goToImage = (index) => {
        setCurrentImageIndex(index);
        setSelectedImage(productImages[index]);
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

            // Handle existing images and create ordered structure
            const existingImgs = [];

            // Main product image
            if (product.image_url || product.image) {
                existingImgs.push(product.image_url || product.image);
            }

            // Images from ProductImage model (your backend structure)
            if (product.product_images && Array.isArray(product.product_images)) {
                existingImgs.push(...product.product_images.map(img => img.image));
            }

            // Fallback for other image fields
            if (product.images && Array.isArray(product.images)) {
                existingImgs.push(...product.images.map(img => img.url || img.image || img));
            }

            if (product.additional_images && Array.isArray(product.additional_images)) {
                existingImgs.push(...product.additional_images.map(img => img.url || img.image || img));
            }

            // Remove duplicates and empty values
            const uniqueExistingImages = [...new Set(existingImgs.filter(img => img))];

            // Create ordered images structure
            const orderedImgs = uniqueExistingImages.map((img, index) => ({
                id: `existing-${index}`,
                src: img,
                type: 'existing',
                order: index,
                originalIndex: index
            }));

            setExistingImages(uniqueExistingImages);
            setImagePreview(uniqueExistingImages[0] || '');
            setImagePreviews(uniqueExistingImages);
            setOrderedImages(orderedImgs);
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
            setExistingImages([]);
            setImagePreview('');
            setImagePreviews([]);
            setOrderedImages([]);
        }
        setImageFile(null);
        setImageFiles([]);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
        setProductFormData({});
        setImageFile(null);
        setImageFiles([]);
        setImagePreview('');
        setImagePreviews([]);
        setExistingImages([]);
        setOrderedImages([]);
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

    const removeOrderedImage = async (imageId) => {
        const imageToRemove = orderedImages.find(img => img.id === imageId);

        if (imageToRemove.type === 'existing' && editingProduct) {
            try {
                // Try to find the image ID if it's a ProductImage
                let backendImageId = null;

                // Check if this image is from product_images array
                if (editingProduct.product_images) {
                    const imageObj = editingProduct.product_images.find(img => img.image === imageToRemove.src);
                    if (imageObj) {
                        backendImageId = imageObj.id;
                    }
                }

                if (backendImageId) {
                    // Delete from backend using the endpoint you have
                    await API.delete(`/admin/products/${editingProduct.id}/remove-image/${backendImageId}/`);
                }

                // Update local state
                setExistingImages(prev => prev.filter(img => img !== imageToRemove.src));
                setImagePreviews(prev => prev.filter(img => img !== imageToRemove.src));

                // Refresh product data
                fetchProducts();
            } catch (error) {
                console.error('Error removing image:', error);
                setError('خطا در حذف تصویر');
            }
        }

        // Remove from ordered images and reorder
        const newOrderedImages = orderedImages
            .filter(img => img.id !== imageId)
            .map((img, index) => ({ ...img, order: index }));

        setOrderedImages(newOrderedImages);

        // Update imageFiles if it's a new image
        if (imageToRemove.type === 'new') {
            const newImageFiles = imageFiles.filter((_, i) => imageToRemove.id !== `new-${i}`);
            setImageFiles(newImageFiles);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        console.log('Files selected:', files); // Debug line

        if (files.length === 0) return;

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB per file
        const maxFiles = 5; // Maximum 5 images

        // Validate files
        const validFiles = [];

        for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
            const file = files[i];

            if (!allowedTypes.includes(file.type)) {
                setError(`فایل ${file.name}: فرمت پشتیبانی نمی‌شود. لطفا فایل JPEG، PNG، GIF یا WebP انتخاب کنید.`);
                continue;
            }

            if (file.size > maxSize) {
                setError(`فایل ${file.name}: حجم نباید بیشتر از 5 مگابایت باشد.`);
                continue;
            }

            validFiles.push(file);
        }

        if (validFiles.length > 0) {
            console.log('Valid files:', validFiles.length); // Debug line

            // FIXED: Set imageFiles properly
            setImageFiles(validFiles); // Replace, don't append

            // Create ordered images structure
            const newOrderedImages = [...orderedImages];
            const startIndex = newOrderedImages.length;

            validFiles.forEach((file, index) => {
                newOrderedImages.push({
                    id: `new-${startIndex + index}`,
                    src: URL.createObjectURL(file),
                    type: 'new',
                    file: file, // Make sure file is stored
                    order: startIndex + index
                });
            });

            setOrderedImages(newOrderedImages);

            // Backward compatibility
            if (validFiles.length === 1) {
                setImageFile(validFiles[0]);
                setImagePreview(URL.createObjectURL(validFiles[0]));
            }

            setError('');
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        // Debug logging - ADD THIS
        console.log('=== FORM SUBMIT DEBUG ===');
        console.log('imageFiles:', imageFiles);
        console.log('orderedImages:', orderedImages);
        console.log('Selected files count:', imageFiles.length);

        const formData = new FormData();

        const excludeFields = ['image_url', 'images', 'additional_images', 'id', 'created_at', 'updated_at', 'stock_status', 'is_out_of_stock', 'days_since_created', 'category_name', 'category_details'];

        Object.keys(productFormData).forEach(key => {
            if (!excludeFields.includes(key) && productFormData[key] !== null && productFormData[key] !== undefined) {
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

        // Check both imageFiles and orderedImages for files
        let hasFiles = false;

        // Method 1: Use imageFiles directly (more reliable)
        if (imageFiles && imageFiles.length > 0) {
            console.log('Using imageFiles directly:', imageFiles.length, 'files');
            imageFiles.forEach((file, index) => {
                formData.append('images', file);
                console.log(`Added file ${index}:`, file.name);
                hasFiles = true;
            });
        } else {
            // Method 2: Fallback to orderedImages
            const orderedNewImages = orderedImages
                .filter(img => img.type === 'new' && img.file)
                .sort((a, b) => a.order - b.order);

            console.log('Using orderedImages:', orderedNewImages.length, 'files');
            orderedNewImages.forEach((imageObj, index) => {
                formData.append('images', imageObj.file);
                console.log(`Added ordered file ${index}:`, imageObj.file.name);
                hasFiles = true;
            });
        }

        //Don't submit if no files for new products
        if (!editingProduct && !hasFiles) {
            console.log('ERROR: No files selected for new product');
            setError('لطفا حداقل یک تصویر انتخاب کنید');
            return;
        }

        // Send image order information
        const imageOrderData = orderedImages.map((img, index) => ({
            type: img.type,
            src: img.type === 'existing' ? img.src : null,
            order: index,
            is_primary: index === 0
        }));

        if (imageOrderData.length > 0) {
            formData.append('image_order', JSON.stringify(imageOrderData));
        }

        // Send existing images that should be kept
        const orderedExistingImages = orderedImages
            .filter(img => img.type === 'existing')
            .sort((a, b) => a.order - b.order)
            .map(img => img.src);

        if (orderedExistingImages.length > 0) {
            formData.append('existing_images', JSON.stringify(orderedExistingImages));
        }

        // Debug FormData contents
        console.log('FormData entries:');
        for (let [key, value] of formData.entries()) {
            console.log(key, value);
        }

        const url = editingProduct ? `/admin/products/${editingProduct.id}/` : '/admin/products/';
        const method = editingProduct ? 'patch' : 'post';

        try {
            await API[method](url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            fetchProducts();
            handleCloseModal();
        } catch (err) {
            console.error('Error saving product:', err.response?.data);
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
        { value: 'all', label: 'همه دسته‌ها' },
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
            <div className="admin-products-main">
                <div className="admin-products-loading">
                    <div className="admin-products-spinner"></div>
                    <p>در حال بارگیری محصولات...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-products-main" dir="rtl">
            {/* Header */}
            <div className="admin-products-header">
                <div className="admin-products-header-content">
                    <div className="admin-products-title-section">
                        <h1 className="admin-products-title">
                            <Package className="admin-products-title-icon" />
                            مدیریت محصولات
                        </h1>
                        <p className="admin-products-subtitle">
                            {filteredProducts.length} محصول از مجموع {products.length} محصول
                        </p>
                    </div>
                    <div className="admin-products-header-actions">
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
                <div className="admin-products-error-banner">
                    <AlertTriangle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {/* Statistics Cards */}
            <div className="admin-products-stats-section">
                <div className="admin-products-stats-grid">
                    <NeoBrutalistCard className="admin-products-stat-card admin-products-stat-total" onClick={() => { setStatusFilter('all'); setStockFilter('all'); }}>
                        <div className="admin-products-stat-content">
                            <Package className="admin-products-stat-icon" />
                            <div className="admin-products-stat-info">
                                <span className="admin-products-stat-number">{productStats.total}</span>
                                <span className="admin-products-stat-label">کل محصولات</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="admin-products-stat-card admin-products-stat-active" onClick={() => setStatusFilter('active')}>
                        <div className="admin-products-stat-content">
                            <CheckCircle className="admin-products-stat-icon" />
                            <div className="admin-products-stat-info">
                                <span className="admin-products-stat-number">{productStats.active}</span>
                                <span className="admin-products-stat-label">فعال</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="admin-products-stat-card admin-products-stat-warning" onClick={() => setStockFilter('low_stock')}>
                        <div className="admin-products-stat-content">
                            <AlertTriangle className="admin-products-stat-icon" />
                            <div className="admin-products-stat-info">
                                <span className="admin-products-stat-number">{productStats.lowStock}</span>
                                <span className="admin-products-stat-label">موجودی کم</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="admin-products-stat-card admin-products-stat-value">
                        <div className="admin-products-stat-content">
                            <DollarSign className="admin-products-stat-icon" />
                            <div className="admin-products-stat-info">
                                <span className="admin-products-stat-number">{formatTotalValue(productStats.totalValue)}</span>
                                <span className="admin-products-stat-label">ارزش کل موجودی</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>
                </div>
            </div>

            {/* Filters Section */}
            <NeoBrutalistCard className="admin-products-filters-card">
                <div className="admin-products-filters-header">
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

                <div className="admin-products-filters-grid">
                    <div className="admin-products-search-wrapper">
                        <Search className="admin-products-search-icon" />
                        <NeoBrutalistInput
                            placeholder="جستجو در نام، توضیحات یا دسته..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="admin-products-search-input"
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
                    <div className="admin-products-bulk-actions">
                        <span>{selectedProducts.length} محصول انتخاب شده</span>
                        <div className="admin-products-bulk-buttons">
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
            <NeoBrutalistCard className="admin-products-table-header">
                <div className="admin-products-table-header-content">
                    <label className="admin-products-select-all-wrapper">
                        <input
                            type="checkbox"
                            checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                            onChange={handleSelectAll}
                        />
                        انتخاب همه
                    </label>
                    <span>نمایش {filteredProducts.length} محصول</span>
                    <div className="admin-products-view-toggles">
                        <NeoBrutalistButton
                            text="📋 لیست"
                            color="blue-400"
                            textColor="white"
                        />
                    </div>
                </div>
            </NeoBrutalistCard>

            {/* Products Grid */}
            <div className="admin-products-grid">
                {filteredProducts.map(product => {
                    const stockStatus = getStockStatus(product.stock);
                    return (
                        <NeoBrutalistCard
                            key={product.id}
                            className={`admin-products-card ${!product.is_active ? 'admin-products-card-inactive' : ''} ${product.is_featured ? 'admin-products-card-featured' : ''}`}
                        >
                            <div className="admin-products-card-header">
                                {/* Product image with navigation */}
                                <div className="admin-products-image-container">
                                    <img
                                        src={getCurrentCardImage(product)}
                                        alt={product.name}
                                        className="admin-products-image"
                                        onClick={() => openImageModal(product)}
                                    />

                                    {/* Image Navigation Controls */}
                                    {getProductImages(product).length > 1 && (
                                        <>
                                            <button
                                                className="admin-products-card-nav-button admin-products-card-prev-button"
                                                onClick={(e) => prevCardImage(product.id, e)}
                                                title="تصویر قبلی"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                            <button
                                                className="admin-products-card-nav-button admin-products-card-next-button"
                                                onClick={(e) => nextCardImage(product.id, e)}
                                                title="تصویر بعدی"
                                            >
                                                <ChevronRight size={20} />
                                            </button>

                                            {/* Image Counter */}
                                            <div className="admin-products-card-image-counter">
                                                {(cardImageIndices[product.id] || 0) + 1} / {getProductImages(product).length}
                                            </div>
                                        </>
                                    )}

                                    {/* Checkbox overlay - top left */}
                                    <label className="admin-products-select-overlay">
                                        <input
                                            type="checkbox"
                                            checked={selectedProducts.includes(product.id)}
                                            onChange={() => handleProductSelect(product.id)}
                                        />
                                    </label>

                                    {/* Status tags overlay - top right */}
                                    <div className="admin-products-tags-overlay">
                                        <span className={`admin-products-tag admin-products-status-tag ${product.is_active ? 'admin-products-active' : 'admin-products-inactive'}`}>
                                            {product.is_active ? (
                                                <><CheckCircle size={12} /> فعال</>
                                            ) : (
                                                <><XCircle size={12} /> غیرفعال</>
                                            )}
                                        </span>
                                        <span className={`admin-products-tag admin-products-stock-tag ${stockStatus.status}`}>
                                            {stockStatus.label}
                                        </span>
                                    </div>

                                    {/* Featured badge - bottom right */}
                                    {product.is_featured && (
                                        <div className="admin-products-featured-badge">
                                            <Star size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="admin-products-info">
                                <h3 className="admin-products-name">{product.name}</h3>
                                {getCategoryDisplayName(product) && (
                                    <span className={`admin-products-category-tag ${getCategoryClass(product)}`}>
                                        {getCategoryDisplayName(product)}
                                    </span>
                                )}
                                <p className="admin-products-description">
                                    {product.description ? (
                                        product.description.length > 150
                                            ? `${product.description.substring(0, 150)}...`
                                            : product.description
                                    ) : 'توضیحاتی برای این محصول ثبت نشده است.'}
                                </p>
                            </div>

                            <div className="admin-products-details">
                                <div className="admin-products-detail-row">
                                    <span className="admin-products-detail-label">قیمت پایه:</span>
                                    <span className="admin-products-detail-value admin-products-price">
                                        {product.base_price.toLocaleString('fa-IR')} ریال
                                    </span>
                                </div>
                                <div className="admin-products-detail-row">
                                    <span className="admin-products-detail-label">نرخ مالیات:</span>
                                    <span className="admin-products-detail-value admin-products-tax-rate">
                                        {product.tax_rate ? `${parseFloat(product.tax_rate).toFixed(1)}%` : '0%'}
                                    </span>
                                </div>
                                {product.tax_rate && product.tax_rate > 0 && (
                                    <div className="admin-products-detail-row">
                                        <span className="admin-products-detail-label">قیمت با مالیات:</span>
                                        <span className="admin-products-detail-value admin-products-price-with-tax">
                                            {(product.base_price * (1 + product.tax_rate / 100)).toLocaleString('fa-IR')} ریال
                                        </span>
                                    </div>
                                )}
                                <div className="admin-products-detail-row">
                                    <span className="admin-products-detail-label">موجودی:</span>
                                    <span className="admin-products-detail-value admin-products-stock-value">
                                        {product.stock.toLocaleString()}
                                    </span>
                                </div>
                                {product.origin && (
                                    <div className="admin-products-detail-row">
                                        <span className="admin-products-detail-label">مبدا:</span>
                                        <span className="admin-products-detail-value">{product.origin}</span>
                                    </div>
                                )}
                            </div>

                            <div className="admin-products-actions">
                                <div className="admin-products-toggle-actions">
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
                                <div className="admin-products-action-buttons">
                                    <NeoBrutalistButton
                                        text={<><Edit size={16} /> ویرایش</>}
                                        color="blue-400"
                                        textColor="white"
                                        onClick={() => handleOpenModal(product)}
                                    />
                                    <NeoBrutalistButton
                                        text={<><Trash2 size={16} /> حذف</>}
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
                <NeoBrutalistCard className="admin-products-empty-state">
                    <div className="admin-products-empty-content">
                        <Package size={48} className="admin-products-empty-icon" />
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

            {/* Enhanced Product Modal with Drag & Drop */}
            <NeoBrutalistModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingProduct ? 'ویرایش محصول' : 'افزودن محصول جدید'}
                size="large"
            >
                <form onSubmit={handleFormSubmit} className="admin-products-form">
                    <div className="admin-products-form-row">
                        <div className="admin-products-form-group">
                            <label>نام محصول</label>
                            <NeoBrutalistInput
                                name="name"
                                value={productFormData.name || ''}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                        <div className="admin-products-form-group">
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

                    <div className="admin-products-form-group">
                        <label>توضیحات</label>
                        <textarea
                            name="description"
                            value={productFormData.description || ''}
                            onChange={handleFormChange}
                            rows="4"
                            className="admin-products-form-textarea"
                            placeholder="توضیحات کامل محصول..."
                        ></textarea>
                    </div>

                    <div className="admin-products-form-row">
                        <div className="admin-products-form-group">
                            <label>موجودی اولیه</label>
                            <NeoBrutalistInput
                                type="number"
                                name="stock"
                                value={productFormData.stock || 0}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                        <div className="admin-products-form-group">
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

                    <div className="admin-products-form-row">
                        <div className="admin-products-form-group">
                            <label>مبدا</label>
                            <NeoBrutalistInput
                                name="origin"
                                value={productFormData.origin || ''}
                                onChange={handleFormChange}
                            />
                        </div>
                        <div className="admin-products-form-group">
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

                    <div className="admin-products-form-row">
                        <div className="admin-products-form-group">
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
                            <small className="admin-products-form-help">
                                نرخ مالیات این محصول به درصد (مثال: 10.00 برای 10%)
                            </small>
                        </div>

                        {productFormData.base_price > 0 && productFormData.tax_rate > 0 && (
                            <div className="admin-products-form-group">
                                <label>پیش‌نمایش قیمت با مالیات</label>
                                <div className="admin-products-price-preview">
                                    <span className="admin-products-preview-base">قیمت پایه: {formatPrice(productFormData.base_price)}</span>
                                    <span className="admin-products-preview-tax">
                                        مالیات ({productFormData.tax_rate}%): {formatPrice(productFormData.base_price * productFormData.tax_rate / 100)}
                                    </span>
                                    <span className="admin-products-preview-total">
                                        قیمت نهایی: {formatPrice(productFormData.base_price * (1 + productFormData.tax_rate / 100))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Enhanced Image Management Section */}
                    <div className="admin-products-form-group">
                        <label>تصاویر محصول</label>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept="image/*"
                            multiple
                            className="admin-products-file-input"
                        />
                        <small className="admin-products-form-help">
                            می‌توانید حداکثر 5 تصویر انتخاب کنید. هر تصویر حداکثر 5 مگابایت باشد.
                            <br />
                            <strong>تصویر اول به عنوان تصویر اصلی نمایش داده می‌شود.</strong> برای تغییر ترتیب، تصاویر را بکشید و رها کنید.
                        </small>

                        {/* Drag & Drop Image Ordering Section */}
                        {orderedImages.length > 0 && (
                            <div className="admin-products-image-ordering">
                                <h4 style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    margin: '20px 0 12px 0',
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    color: '#374151'
                                }}>
                                    <Move size={16} />
                                    ترتیب نمایش تصاویر (تصویر اول = تصویر اصلی)
                                </h4>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '16px',
                                    marginBottom: '16px',
                                    padding: '16px',
                                    background: '#f8fafc',
                                    border: '3px solid #000',
                                    borderRadius: '8px'
                                }}>
                                    {orderedImages.map((imageObj, index) => (
                                        <div
                                            key={imageObj.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, index)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={handleDragOver}
                                            onDragEnter={(e) => handleDragEnter(e, index)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, index)}
                                            style={{
                                                position: 'relative',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                padding: '12px',
                                                background: index === 0 ? '#dbeafe' : '#ffffff',
                                                border: `4px solid ${
                                                    index === 0 ? '#3b82f6' :
                                                        draggedOver === index ? '#10b981' : '#000'
                                                }`,
                                                borderRadius: '8px',
                                                cursor: 'move',
                                                transition: 'all 0.3s ease',
                                                transform: draggedIndex === index ? 'scale(0.95) rotate(5deg)' : 'scale(1)',
                                                boxShadow: draggedIndex === index ? '8px 8px 0px rgba(0,0,0,0.3)' : '4px 4px 0px rgba(0,0,0,0.2)',
                                                opacity: draggedIndex === index ? 0.7 : 1
                                            }}
                                        >
                                            {/* Image Order Badge */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '-8px',
                                                left: '-8px',
                                                width: '28px',
                                                height: '28px',
                                                background: index === 0 ? '#3b82f6' : '#64748b',
                                                color: 'white',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.8rem',
                                                fontWeight: '900',
                                                border: '3px solid #000',
                                                zIndex: 10
                                            }}>
                                                {index + 1}
                                            </div>

                                            {/* Primary Badge */}
                                            {index === 0 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '-8px',
                                                    right: '-8px',
                                                    background: '#f59e0b',
                                                    color: 'white',
                                                    padding: '4px 8px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: '800',
                                                    border: '2px solid #000',
                                                    borderRadius: '4px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '1px',
                                                    zIndex: 10
                                                }}>
                                                    اصلی
                                                </div>
                                            )}

                                            {/* Drag Handle */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                color: '#64748b',
                                                cursor: 'move',
                                                padding: '4px',
                                                background: 'rgba(255, 255, 255, 0.9)',
                                                borderRadius: '4px',
                                                zIndex: 9
                                            }}>
                                                <GripVertical size={16} />
                                            </div>

                                            {/* Image */}
                                            <img
                                                src={imageObj.src}
                                                alt={`Product ${index + 1}`}
                                                style={{
                                                    width: '120px',
                                                    height: '120px',
                                                    objectFit: 'cover',
                                                    borderRadius: '4px',
                                                    marginBottom: '8px',
                                                    pointerEvents: 'none'
                                                }}
                                            />

                                            {/* Image Controls */}
                                            <div style={{
                                                display: 'flex',
                                                gap: '8px',
                                                alignItems: 'center',
                                                marginTop: '8px'
                                            }}>
                                                {/* Move Up Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => moveImageUp(index)}
                                                    disabled={index === 0}
                                                    style={{
                                                        padding: '4px',
                                                        background: index === 0 ? '#e5e7eb' : '#3b82f6',
                                                        color: index === 0 ? '#9ca3af' : 'white',
                                                        border: '2px solid #000',
                                                        borderRadius: '4px',
                                                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '12px',
                                                        fontWeight: '600'
                                                    }}
                                                    title="انتقال به بالا"
                                                >
                                                    <ArrowUp size={12} />
                                                </button>

                                                {/* Move Down Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => moveImageDown(index)}
                                                    disabled={index === orderedImages.length - 1}
                                                    style={{
                                                        padding: '4px',
                                                        background: index === orderedImages.length - 1 ? '#e5e7eb' : '#3b82f6',
                                                        color: index === orderedImages.length - 1 ? '#9ca3af' : 'white',
                                                        border: '2px solid #000',
                                                        borderRadius: '4px',
                                                        cursor: index === orderedImages.length - 1 ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '12px',
                                                        fontWeight: '600'
                                                    }}
                                                    title="انتقال به پایین"
                                                >
                                                    <ArrowDown size={12} />
                                                </button>

                                                {/* Remove Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => removeOrderedImage(imageObj.id)}
                                                    style={{
                                                        padding: '4px 6px',
                                                        background: '#ef4444',
                                                        color: 'white',
                                                        border: '2px solid #000',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '14px',
                                                        fontWeight: '900',
                                                        lineHeight: 1
                                                    }}
                                                    title="حذف تصویر"
                                                >
                                                    ×
                                                </button>
                                            </div>

                                            {/* Image Type Label */}
                                            <span style={{
                                                fontSize: '0.7rem',
                                                color: '#64748b',
                                                fontWeight: '600',
                                                textAlign: 'center',
                                                marginTop: '4px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px'
                                            }}>
                                                {imageObj.type === 'existing' ? 'موجود' : 'جدید'}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Drag & Drop Instructions */}
                                <div style={{
                                    padding: '12px 16px',
                                    background: '#f0f9ff',
                                    border: '3px solid #3b82f6',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    color: '#1e40af',
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    margin: '16px 0'
                                }}>
                                    💡 برای تغییر ترتیب: تصاویر را بگیرید و بکشید | دکمه‌های بالا/پایین را استفاده کنید | تصویر اول همیشه تصویر اصلی محصول است
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="admin-products-form-row">
                        <div className="admin-products-form-group">
                            <NeoBrutalistToggle
                                checked={productFormData.is_active || false}
                                onChange={(e) => setProductFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                label="محصول فعال باشد"
                            />
                        </div>
                        <div className="admin-products-form-group">
                            <NeoBrutalistToggle
                                checked={productFormData.is_featured || false}
                                onChange={(e) => setProductFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                                label="محصول ویژه"
                            />
                        </div>
                    </div>

                    <div className="admin-products-form-actions">
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

            {/* Enhanced Image Modal with Navigation */}
            <NeoBrutalistModal
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                title="نمایش تصاویر محصول"
                size="large"
            >
                <div className="admin-products-image-modal">
                    <div className="admin-products-image-gallery">
                        <div className="admin-products-main-image-container">
                            {productImages.length > 1 && (
                                <button
                                    className="admin-products-nav-button admin-products-prev-button"
                                    onClick={prevImage}
                                    disabled={productImages.length <= 1}
                                >
                                    <ChevronLeft size={24} />
                                </button>
                            )}

                            <img
                                src={selectedImage}
                                alt="Product"
                                className="admin-products-modal-image"
                            />

                            {productImages.length > 1 && (
                                <button
                                    className="admin-products-nav-button admin-products-next-button"
                                    onClick={nextImage}
                                    disabled={productImages.length <= 1}
                                >
                                    <ChevronRight size={24} />
                                </button>
                            )}
                        </div>

                        {productImages.length > 1 && (
                            <div className="admin-products-image-counter">
                                {currentImageIndex + 1} از {productImages.length}
                            </div>
                        )}

                        {productImages.length > 1 && (
                            <div className="admin-products-thumbnails">
                                {productImages.map((img, index) => (
                                    <img
                                        key={index}
                                        src={img}
                                        alt={`Product ${index + 1}`}
                                        className={`admin-products-thumbnail ${index === currentImageIndex ? 'admin-products-thumbnail-active' : ''}`}
                                        onClick={() => goToImage(index)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </NeoBrutalistModal>
        </div>
    );
};

export default AdminProductsPage;