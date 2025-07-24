import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api'; // Assuming API setup is in this path
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistToggle from '../../component/NeoBrutalist/NeoBrutalistToggle'; // <-- IMPORT THE NEW COMPONENT
import '../../styles/Admin/AdminProducts.css';

const AdminProductsPage = () => {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Editing and Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null); // null for new, product object for editing
    const [productFormData, setProductFormData] = useState({});
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState('');

    // Filtering and Sorting State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [stockFilter, setStockFilter] = useState('all'); // 'all', 'in_stock', 'low_stock', 'out_of_stock'

    const navigate = useNavigate();

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/products/');
            setProducts(response.data);
            setError('');
        } catch (err) {
            console.error('❌ Error fetching products:', err);
            setError('خطا در بارگیری لیست محصولات');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    useEffect(() => {
        let filtered = [...products];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.description.toLowerCase().includes(searchTerm.toLowerCase())
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
                if (stockFilter === 'low_stock') return p.stock > 0 && p.stock <= 10;
                if (stockFilter === 'in_stock') return p.stock > 10;
                return true;
            });
        }

        setFilteredProducts(filtered);
    }, [products, searchTerm, statusFilter, stockFilter]);

    const handleOpenModal = (product = null) => {
        setEditingProduct(product);
        if (product) {
            setProductFormData({ ...product });
            setImagePreview(product.image_url || '');
        } else {
            // Default state for a new product
            setProductFormData({
                name: '',
                description: '',
                category: '',
                origin: '',
                base_price: 0,
                stock: 0,
                is_active: true,
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
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleToggleChange = (checked) => {
        setProductFormData(prev => ({
            ...prev,
            is_active: checked
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();

        Object.keys(productFormData).forEach(key => {
            if (key !== 'image_url' && key !== 'id' && productFormData[key] !== null) {
                formData.append(key, productFormData[key]);
            }
        });

        if (imageFile) {
            formData.append('image', imageFile);
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
            await API.post(`/admin/products/${productId}/update-stock/`, { stock });
            fetchProducts();
        } catch(err) {
            console.error('Error updating stock', err);
            setError('خطا در به‌روزرسانی موجودی');
        }
    };


    if (loading) return <div className="admin-page-container"><h1>در حال بارگیری...</h1></div>;

    return (
        <div className="admin-page-container admin-products-page" dir="rtl">
            <div className="page-header">
                <h1>📦 مدیریت محصولات</h1>
                <NeoBrutalistButton
                    text="+ افزودن محصول جدید"
                    color="green-400"
                    textColor="black"
                    onClick={() => handleOpenModal()}
                />
            </div>

            {error && <div className="error-banner">⚠️ {error}</div>}

            <NeoBrutalistCard className="filters-card">
                <div className="filters-grid">
                    <NeoBrutalistInput
                        type="text"
                        placeholder="جستجو در نام و توضیحات..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
                        <option value="all">همه وضعیت‌ها</option>
                        <option value="active">فعال</option>
                        <option value="inactive">غیرفعال</option>
                    </select>
                    <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} className="filter-select">
                        <option value="all">همه موجودی‌ها</option>
                        <option value="in_stock">موجود</option>
                        <option value="low_stock">موجودی کم</option>
                        <option value="out_of_stock">ناموجود</option>
                    </select>
                </div>
            </NeoBrutalistCard>

            <div className="products-table-container">
                <table className="products-table">
                    <thead>
                    <tr>
                        <th>تصویر</th>
                        <th>نام محصول</th>
                        <th>دسته</th>
                        <th>موجودی</th>
                        <th>قیمت پایه (ریال)</th>
                        <th>وضعیت</th>
                        <th>عملیات</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredProducts.map(p => (
                        <tr key={p.id}>
                            <td>
                                <img src={p.image_url || 'https://placehold.co/60x60/e2e8f0/a0aec0?text=No+Image'} alt={p.name} className="product-thumbnail" />
                            </td>
                            <td data-label="نام محصول">{p.name}</td>
                            <td data-label="دسته">{p.category || '-'}</td>
                            <td data-label="موجودی" className="stock-cell">
                                <NeoBrutalistInput
                                    type="number"
                                    defaultValue={p.stock}
                                    onBlur={(e) => handleQuickStockUpdate(p.id, e.target.value)}
                                    className="stock-input"
                                />
                            </td>
                            <td data-label="قیمت">{p.base_price.toLocaleString('fa-IR')}</td>
                            <td data-label="وضعیت">
                                {/* --- REPLACED WITH NEW COMPONENT --- */}
                                <NeoBrutalistToggle
                                    checked={p.is_active}
                                    onChange={() => handleToggleStatus(p)}
                                />
                            </td>
                            <td data-label="عملیات" className="actions-cell">
                                <NeoBrutalistButton text="ویرایش" color="blue-400" textColor="white" onClick={() => handleOpenModal(p)} />
                                <NeoBrutalistButton text="حذف" color="red-400" textColor="white" onClick={() => handleDeleteProduct(p.id)} />
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            <NeoBrutalistModal isOpen={isModalOpen} onClose={handleCloseModal} title={editingProduct ? 'ویرایش محصول' : 'افزودن محصول جدید'}>
                <form onSubmit={handleFormSubmit} className="product-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>نام محصول</label>
                            <NeoBrutalistInput name="name" value={productFormData.name || ''} onChange={handleFormChange} required />
                        </div>
                        <div className="form-group">
                            <label>دسته</label>
                            <NeoBrutalistInput name="category" value={productFormData.category || ''} onChange={handleFormChange} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>توضیحات</label>
                        <textarea name="description" value={productFormData.description || ''} onChange={handleFormChange} rows="4" className="form-textarea"></textarea>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>موجودی اولیه</label>
                            <NeoBrutalistInput type="number" name="stock" value={productFormData.stock || 0} onChange={handleFormChange} required />
                        </div>
                        <div className="form-group">
                            <label>قیمت پایه (ریال)</label>
                            <NeoBrutalistInput type="number" name="base_price" value={productFormData.base_price || 0} onChange={handleFormChange} required />
                        </div>
                        <div className="form-group">
                            <label>مبدا</label>
                            <NeoBrutalistInput name="origin" value={productFormData.origin || ''} onChange={handleFormChange} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>تصویر محصول</label>
                        <input type="file" onChange={handleFileChange} accept="image/*" className="file-input"/>
                        {imagePreview && <img src={imagePreview} alt="Preview" className="image-preview" />}
                    </div>

                    {/* --- REPLACED WITH NEW COMPONENT --- */}
                    <div className="form-group">
                        <NeoBrutalistToggle
                            checked={productFormData.is_active || false}
                            onChange={(e) => handleToggleChange(e.target.checked)}
                            label="محصول فعال باشد"
                        />
                    </div>

                    <div className="form-actions">
                        <NeoBrutalistButton text="لغو" color="gray-400" textColor="black" onClick={handleCloseModal} type="button" />
                        <NeoBrutalistButton text="ذخیره تغییرات" color="green-400" textColor="black" type="submit" />
                    </div>
                </form>
            </NeoBrutalistModal>
        </div>
    );
};

export default AdminProductsPage;
