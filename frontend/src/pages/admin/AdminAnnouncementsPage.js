import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Megaphone, Search, Filter, Eye, Edit, Star, Calendar,
    Image as ImageIcon, CheckCircle, XCircle, Plus, Download,
    TrendingUp, AlertCircle, Users, Package
} from 'lucide-react';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistDropdown from '../../component/NeoBrutalist/NeoBrutalistDropdown';
import NeoBrutalistToggle from '../../component/NeoBrutalist/NeoBrutalistToggle';
import API from '../../component/api';
import '../../styles/Admin/AdminAnnouncements.css';


const AdminAnnouncementsPage = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [filteredAnnouncements, setFilteredAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal and Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [selectedImages, setSelectedImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Form Data
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        is_active: true,
        is_featured: false,
        shipment_date: '',
        origin_country: '',
        estimated_arrival: '',
        product_categories: ''
    });
    const [imageFiles, setImageFiles] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);

    // Filtering and Sorting State
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [featuredFilter, setFeaturedFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');

    // Bulk Actions
    const [selectedAnnouncements, setSelectedAnnouncements] = useState([]);
    const [showBulkActions, setShowBulkActions] = useState(false);

    // Stats
    const [announcementStats, setAnnouncementStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        featured: 0,
        thisMonth: 0,
        totalViews: 0
    });

    const navigate = useNavigate();

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/announcements/');
            setAnnouncements(response.data);
            calculateStats(response.data);
            setError('');
        } catch (err) {
            if (err.response?.status === 401) {
                setError('نشست شما منقضی شده است. در حال انتقال به صفحه ورود...');
                setTimeout(() => handleLogout(), 2000);
            } else {
                setError('خطا در بارگیری اطلاعیه‌ها');
            }
        } finally {
            setLoading(false);
        }
    }, []);



    useEffect(() => {
        fetchAnnouncements();
    }, [fetchAnnouncements]);

    const calculateStats = (announcementsList) => {
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const stats = {
            total: announcementsList.length,
            active: announcementsList.filter(a => a.is_active).length,
            inactive: announcementsList.filter(a => !a.is_active).length,
            featured: announcementsList.filter(a => a.is_featured).length,
            thisMonth: announcementsList.filter(a => new Date(a.created_at) >= thisMonth).length,
            totalViews: announcementsList.reduce((sum, a) => sum + (a.view_count || 0), 0)
        };
        setAnnouncementStats(stats);
    };

    useEffect(() => {
        let filtered = [...announcements];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(a =>
                a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.origin_country?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(a => a.is_active === (statusFilter === 'active'));
        }

        // Featured filter
        if (featuredFilter !== 'all') {
            filtered = filtered.filter(a => a.is_featured === (featuredFilter === 'featured'));
        }

        // Date filter
        if (dateFilter !== 'all') {
            const now = new Date();
            filtered = filtered.filter(a => {
                const announcementDate = new Date(a.created_at);
                switch (dateFilter) {
                    case 'today':
                        return announcementDate.toDateString() === now.toDateString();
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        return announcementDate >= weekAgo;
                    case 'month':
                        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
                        return announcementDate >= monthAgo;
                    default:
                        return true;
                }
            });
        }

        // Sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'oldest':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'title':
                    return a.title.localeCompare(b.title, 'fa');
                case 'views':
                    return (b.view_count || 0) - (a.view_count || 0);
                default:
                    return 0;
            }
        });

        setFilteredAnnouncements(filtered);
    }, [announcements, searchTerm, statusFilter, featuredFilter, dateFilter, sortBy]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    const handleOpenModal = (announcement = null) => {
        setEditingAnnouncement(announcement);
        if (announcement) {
            // Format dates for input fields
            const formattedAnnouncement = {
                ...announcement,
                shipment_date: announcement.shipment_date ? announcement.shipment_date.split('T')[0] : '',
                estimated_arrival: announcement.estimated_arrival ? announcement.estimated_arrival.split('T')[0] : ''
            };
            setFormData(formattedAnnouncement);
            setImagePreviews(announcement.images ? announcement.images.map(img => img.image) : []);
        } else {
            setFormData({
                title: '',
                description: '',
                is_active: true,
                is_featured: false,
                shipment_date: '',
                origin_country: '',
                estimated_arrival: '',
                product_categories: ''
            });
            setImagePreviews([]);
        }
        setImageFiles([]);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAnnouncement(null);
        setFormData({});
        setImageFiles([]);
        setImagePreviews([]);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);

        if (files.length) {
            // Validate file types and sizes
            const allowedTypes = ['image/jpeg', 'image/jpg', 'images/png', 'image/gif', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB

            const validFiles = [];
            const invalidFiles = [];

            files.forEach(file => {
                if (!allowedTypes.includes(file.type)) {
                    invalidFiles.push(`${file.name}: نوع فایل پشتیبانی نمی‌شود`);
                } else if (file.size > maxSize) {
                    invalidFiles.push(`${file.name}: حجم فایل بیش از 5MB است`);
                } else {
                    validFiles.push(file);
                }
            });

            if (invalidFiles.length > 0) {
                setError(`فایل‌های زیر معتبر نیستند:\n${invalidFiles.join('\n')}`);
                e.target.value = ''; // Clear the input
                return;
            }

            setImageFiles(validFiles);
            const previews = validFiles.map(file => URL.createObjectURL(file));
            setImagePreviews(previews);
            setError(''); // Clear any previous errors
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title?.trim()) {
            setError('عنوان اطلاعیه الزامی است');
            return;
        }

        if (!formData.description?.trim()) {
            setError('توضیحات الزامی است');
            return;
        }

        try {
            const submissionForm = new FormData();

            // Add all form fields except images and read-only fields
            const excludeFields = ['images', 'id', 'created_at', 'updated_at', 'created_by', 'created_by_name', 'products_count', 'view_count', 'image_url'];

            Object.keys(formData).forEach(key => {
                if (!excludeFields.includes(key) && formData[key] !== null && formData[key] !== undefined) {
                    // Handle boolean fields
                    if (key === 'is_active' || key === 'is_featured') {
                        submissionForm.append(key, formData[key] ? 'true' : 'false');
                    } else {
                        submissionForm.append(key, formData[key]);
                    }
                }
            });

            // Add images
            imageFiles.forEach((file) => {
                submissionForm.append('images', file);
            });

            const url = editingAnnouncement
                ? `/admin/announcements/${editingAnnouncement.id}/`
                : '/admin/announcements/';
            const method = editingAnnouncement ? 'patch' : 'post';

            const response = await API[method](url, submissionForm, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            fetchAnnouncements();
            handleCloseModal();

        } catch (err) {
            let errorMessage = 'خطا در ذخیره اطلاعیه';

            if (err.response?.data) {
                if (typeof err.response.data === 'string') {
                    errorMessage = err.response.data;
                } else if (err.response.data.error) {
                    errorMessage = err.response.data.error;
                } else if (err.response.data.details) {
                    // Handle validation errors
                    const details = err.response.data.details;
                    const errorMessages = [];

                    Object.keys(details).forEach(field => {
                        if (Array.isArray(details[field])) {
                            errorMessages.push(`${field}: ${details[field].join(', ')}`);
                        } else {
                            errorMessages.push(`${field}: ${details[field]}`);
                        }
                    });

                    errorMessage = errorMessages.join('; ');
                } else {
                    errorMessage = JSON.stringify(err.response.data);
                }
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(`خطا در ذخیره اطلاعیه: ${errorMessage}`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('آیا از حذف این اطلاعیه اطمینان دارید؟')) {
            try {
                await API.delete(`/admin/announcements/${id}/`);
                fetchAnnouncements();
            } catch (err) {
                setError('خطا در حذف اطلاعیه');
            }
        }
    };

    const handleToggleStatus = async (announcementId, currentStatus) => {
        try {
            // Update local state immediately for better UX
            setAnnouncements(prev =>
                prev.map(ann =>
                    ann.id === announcementId
                        ? { ...ann, is_active: !currentStatus }
                        : ann
                )
            );

            // Make API call
            await API.patch(`/admin/announcements/${announcementId}/`, {
                is_active: !currentStatus
            });

            // Refresh to ensure consistency
            fetchAnnouncements();
        } catch (err) {
            setError('خطا در تغییر وضعیت اطلاعیه');
            // Revert on error
            fetchAnnouncements();
        }
    };

    const handleToggleFeatured = async (announcementId, currentFeatured) => {
        try {
            // Update local state immediately
            setAnnouncements(prev =>
                prev.map(ann =>
                    ann.id === announcementId
                        ? { ...ann, is_featured: !currentFeatured }
                        : ann
                )
            );

            // Make API call
            await API.patch(`/admin/announcements/${announcementId}/`, {
                is_featured: !currentFeatured
            });

            // Refresh to ensure consistency
            fetchAnnouncements();
        } catch (err) {
            setError('خطا در تغییر وضعیت ویژه اطلاعیه');
            fetchAnnouncements();
        }
    };

    const handleAnnouncementSelect = (announcementId) => {
        setSelectedAnnouncements(prev => {
            const newSelection = prev.includes(announcementId)
                ? prev.filter(id => id !== announcementId)
                : [...prev, announcementId];
            setShowBulkActions(newSelection.length > 0);
            return newSelection;
        });
    };

    const handleSelectAll = () => {
        if (selectedAnnouncements.length === filteredAnnouncements.length) {
            setSelectedAnnouncements([]);
            setShowBulkActions(false);
        } else {
            const allIds = filteredAnnouncements.map(a => a.id);
            setSelectedAnnouncements(allIds);
            setShowBulkActions(true);
        }
    };

    const handleBulkAction = async (action) => {
        if (selectedAnnouncements.length === 0) {
            setError('هیچ اطلاعیه‌ای انتخاب نشده است');
            return;
        }

        try {
            const response = await API.post('/admin/announcements/bulk-action/', {
                action,
                announcement_ids: selectedAnnouncements
            });

            // Refresh the announcements list
            fetchAnnouncements();

            // Clear selection
            setSelectedAnnouncements([]);
            setShowBulkActions(false);

            // Clear any errors
            setError('');

        } catch (err) {
            let errorMessage = 'خطا در انجام عملیات گروهی';
            if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            }

            setError(errorMessage);
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setFeaturedFilter('all');
        setDateFilter('all');
        setSortBy('newest');
    };

    const handleViewImages = (images) => {
        if (images && images.length > 0) {
            setSelectedImages(images);
            setCurrentImageIndex(0);
            setIsImageModalOpen(true);
        }
    };

    const nextImage = () => {
        setCurrentImageIndex((prev) =>
            prev === selectedImages.length - 1 ? 0 : prev + 1
        );
    };

    const prevImage = () => {
        setCurrentImageIndex((prev) =>
            prev === 0 ? selectedImages.length - 1 : prev - 1
        );
    };

    const statusOptions = [
        { value: 'all', label: 'همه وضعیت‌ها' },
        { value: 'active', label: 'فعال' },
        { value: 'inactive', label: 'غیرفعال' }
    ];

    const featuredOptions = [
        { value: 'all', label: 'همه اطلاعیه‌ها' },
        { value: 'featured', label: 'ویژه' },
        { value: 'normal', label: 'عادی' }
    ];

    const dateOptions = [
        { value: 'all', label: 'همه تاریخ‌ها' },
        { value: 'today', label: 'امروز' },
        { value: 'week', label: 'هفته گذشته' },
        { value: 'month', label: 'ماه گذشته' }
    ];

    const sortOptions = [
        { value: 'newest', label: 'جدیدترین' },
        { value: 'oldest', label: 'قدیمی‌ترین' },
        { value: 'title', label: 'عنوان' },
        { value: 'views', label: 'بازدید' }
    ];

    if (loading) {
        return (
            <div className="admin-announcements-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>در حال بارگیری اطلاعیه‌ها...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-announcements-page" dir="rtl">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="page-title">
                            <Megaphone className="title-icon" />
                            مدیریت اطلاعیه محموله‌ها
                        </h1>
                        <p className="page-subtitle">
                            {filteredAnnouncements.length} اطلاعیه از مجموع {announcements.length} اطلاعیه
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="+ ثبت اطلاعیه جدید"
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
                    <AlertCircle size={20} />
                    <span>{error}</span>
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {/* Statistics Cards */}
            <div className="stats-section">
                <div className="stats-grid">
                    <NeoBrutalistCard className="stat-card total" onClick={() => { setStatusFilter('all'); setFeaturedFilter('all'); }}>
                        <div className="stat-content">
                            <Megaphone className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{announcementStats.total}</span>
                                <span className="stat-label">کل اطلاعیه‌ها</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card active" onClick={() => setStatusFilter('active')}>
                        <div className="stat-content">
                            <CheckCircle className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{announcementStats.active}</span>
                                <span className="stat-label">فعال</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card featured" onClick={() => setFeaturedFilter('featured')}>
                        <div className="stat-content">
                            <Star className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{announcementStats.featured}</span>
                                <span className="stat-label">ویژه</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card month" onClick={() => setDateFilter('month')}>
                        <div className="stat-content">
                            <Calendar className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{announcementStats.thisMonth}</span>
                                <span className="stat-label">این ماه</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card views">
                        <div className="stat-content">
                            <TrendingUp className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{announcementStats.totalViews}</span>
                                <span className="stat-label">کل بازدید</span>
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
                            placeholder="جستجو در عنوان، توضیحات یا مبدا..."
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
                        label="نوع اطلاعیه"
                        options={featuredOptions}
                        value={featuredFilter}
                        onChange={(value) => setFeaturedFilter(value)}
                    />

                    <NeoBrutalistDropdown
                        label="تاریخ"
                        options={dateOptions}
                        value={dateFilter}
                        onChange={(value) => setDateFilter(value)}
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
                        <span>{selectedAnnouncements.length} اطلاعیه انتخاب شده</span>
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

            {/* Announcements Header */}
            <NeoBrutalistCard className="table-header">
                <div className="table-header-content">
                    <label className="select-all-wrapper">
                        <input
                            type="checkbox"
                            checked={selectedAnnouncements.length === filteredAnnouncements.length && filteredAnnouncements.length > 0}
                            onChange={handleSelectAll}
                        />
                        انتخاب همه
                    </label>
                    <span>نمایش {filteredAnnouncements.length} اطلاعیه</span>
                </div>
            </NeoBrutalistCard>

            {/* Announcements Grid */}
            <div className="announcements-grid">
                {filteredAnnouncements.map(announcement => (
                    <NeoBrutalistCard
                        key={announcement.id}
                        className={`announcement-card ${!announcement.is_active ? 'inactive' : ''} ${announcement.is_featured ? 'featured' : ''}`}
                    >
                        <div className="card-header">
                            <label className="announcement-select">
                                <input
                                    type="checkbox"
                                    checked={selectedAnnouncements.includes(announcement.id)}
                                    onChange={() => handleAnnouncementSelect(announcement.id)}
                                />
                            </label>

                            <div className="announcement-info">
                                <h3 className="announcement-title">{announcement.title}</h3>
                                <div className="announcement-meta">
                                    <span className="date">
                                        <Calendar size={14} />
                                        {new Date(announcement.created_at).toLocaleDateString('fa-IR')}
                                    </span>
                                    {announcement.view_count && (
                                        <span className="views">
                                            <Eye size={14} />
                                            {announcement.view_count} بازدید
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="announcement-tags">
                                {announcement.is_featured && (
                                    <span className="tag featured-tag">
                                        <Star size={12} />
                                        ویژه
                                    </span>
                                )}
                                <span className={`tag status-tag ${announcement.is_active ? 'active' : 'inactive'}`}>
                                    {announcement.is_active ? (
                                        <><CheckCircle size={12} /> فعال</>
                                    ) : (
                                        <><XCircle size={12} /> غیرفعال</>
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="announcement-content">
                            <p className="announcement-description">
                                {announcement.description?.substring(0, 150)}...
                            </p>

                            {announcement.origin_country && (
                                <div className="detail-row">
                                    <span className="detail-label">مبدا:</span>
                                    <span className="detail-value">{announcement.origin_country}</span>
                                </div>
                            )}

                            {announcement.shipment_date && (
                                <div className="detail-row">
                                    <span className="detail-label">تاریخ ارسال:</span>
                                    <span className="detail-value">
                                        {new Date(announcement.shipment_date).toLocaleDateString('fa-IR')}
                                    </span>
                                </div>
                            )}

                            {announcement.estimated_arrival && (
                                <div className="detail-row">
                                    <span className="detail-label">تاریخ تخمینی رسیدن:</span>
                                    <span className="detail-value">
                                        {new Date(announcement.estimated_arrival).toLocaleDateString('fa-IR')}
                                    </span>
                                </div>
                            )}

                            {announcement.product_categories && (
                                <div className="detail-row">
                                    <span className="detail-label">دسته‌بندی محصولات:</span>
                                    <span className="detail-value">{announcement.product_categories}</span>
                                </div>
                            )}
                        </div>

                        <div className="announcement-images">
                            {announcement.images && announcement.images.length > 0 && (
                                <div className="images-preview">
                                    <div className="images-grid">
                                        {announcement.images.slice(0, 3).map((img, index) => (
                                            <img
                                                key={index}
                                                src={img.image}
                                                alt={`Preview ${index + 1}`}
                                                className="preview-thumb"
                                                onClick={() => handleViewImages(announcement.images)}
                                            />
                                        ))}
                                    </div>
                                    {announcement.images.length > 3 && (
                                        <div className="more-images" onClick={() => handleViewImages(announcement.images)}>
                                            <ImageIcon size={16} />
                                            +{announcement.images.length - 3} تصویر دیگر
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="announcement-actions">
                            <div className="toggle-actions">
                                <NeoBrutalistToggle
                                    checked={announcement.is_active}
                                    onChange={(e) => handleToggleStatus(announcement.id, announcement.is_active)}
                                    label="فعال"
                                    color="green"
                                    size="medium"
                                />
                                <NeoBrutalistToggle
                                    checked={announcement.is_featured}
                                    onChange={(e) => handleToggleFeatured(announcement.id, announcement.is_featured)}
                                    label="ویژه"
                                    color="yellow"
                                    size="medium"
                                />
                            </div>
                            <div className="action-buttons">
                                <NeoBrutalistButton
                                    text="ویرایش"
                                    color="blue-400"
                                    textColor="white"
                                    onClick={() => handleOpenModal(announcement)}
                                />
                                <NeoBrutalistButton
                                    text="حذف"
                                    color="red-400"
                                    textColor="white"
                                    onClick={() => handleDelete(announcement.id)}
                                />
                            </div>
                        </div>
                    </NeoBrutalistCard>
                ))}
            </div>

            {/* Empty State */}
            {filteredAnnouncements.length === 0 && !loading && (
                <NeoBrutalistCard className="empty-state-card">
                    <div className="empty-content">
                        <Megaphone size={48} className="empty-icon" />
                        <h3>اطلاعیه‌ای یافت نشد</h3>
                        <p>
                            {announcements.length === 0
                                ? 'هنوز اطلاعیه‌ای ثبت نشده است.'
                                : 'بر اساس فیلترهای انتخاب شده، اطلاعیه‌ای یافت نشد.'
                            }
                        </p>
                        {announcements.length > 0 && (
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

            {/* Announcement Modal */}
            <NeoBrutalistModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={editingAnnouncement ? 'ویرایش اطلاعیه' : 'ثبت اطلاعیه جدید'}
                size="large"
            >
                <form onSubmit={handleFormSubmit} className="announcement-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>عنوان اطلاعیه</label>
                            <NeoBrutalistInput
                                name="title"
                                value={formData.title || ''}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>کشور مبدا</label>
                            <NeoBrutalistInput
                                name="origin_country"
                                value={formData.origin_country || ''}
                                onChange={handleFormChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>توضیحات</label>
                        <textarea
                            name="description"
                            value={formData.description || ''}
                            onChange={handleFormChange}
                            rows="5"
                            className="form-textarea"
                            required
                            placeholder="توضیحات کامل در مورد محموله..."
                        ></textarea>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>تاریخ ارسال محموله</label>
                            <NeoBrutalistInput
                                type="date"
                                name="shipment_date"
                                value={formData.shipment_date || ''}
                                onChange={handleFormChange}
                            />
                        </div>
                        <div className="form-group">
                            <label>تاریخ تخمینی رسیدن</label>
                            <NeoBrutalistInput
                                type="date"
                                name="estimated_arrival"
                                value={formData.estimated_arrival || ''}
                                onChange={handleFormChange}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>دسته‌بندی محصولات</label>
                        <NeoBrutalistInput
                            name="product_categories"
                            value={formData.product_categories || ''}
                            onChange={handleFormChange}
                            placeholder="مثال: قهوه, محصولات قنادی, ادویه ..."
                        />
                    </div>

                    <div className="form-group">
                        <label>تصاویر محموله</label>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            multiple
                            accept="images/jpeg,images/jpg,images/png,images/gif,images/webp"
                            className="file-input"
                        />
                        <p className="file-help-text">
                            فرمت‌های مجاز: JPEG, PNG, GIF, WebP - حداکثر 5MB برای هر فایل
                        </p>

                        {imagePreviews.length > 0 && (
                            <div className="image-previews-container">
                                {imagePreviews.map((src, i) => (
                                    <div key={i} className="image-preview-wrapper">
                                        <img src={src} alt={`preview ${i}`} className="image-preview" />
                                        <span className="image-preview-label">تصویر {i + 1}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {editingAnnouncement && imagePreviews.length === 0 && (
                            <p className="form-note">
                                برای تغییر تصاویر، فایل‌های جدید انتخاب کنید. عدم انتخاب فایل، تصاویر فعلی را حفظ می‌کند.
                            </p>
                        )}
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <NeoBrutalistToggle
                                checked={formData.is_active || false}
                                onChange={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setFormData(prev => ({ ...prev, is_active: e.target.checked }));
                                }}
                                label="اطلاعیه فعال باشد"
                                color="green"
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
                            text="ذخیره"
                            color="green-400"
                            textColor="black"
                            type="submit"
                        />
                    </div>
                </form>
            </NeoBrutalistModal>

            {/* Image Gallery Modal */}
            <NeoBrutalistModal
                isOpen={isImageModalOpen}
                onClose={() => setIsImageModalOpen(false)}
                title="گالری تصاویر"
                size="large"
            >
                <div className="image-gallery">
                    {selectedImages.length > 0 && (
                        <>
                            <div className="gallery-main">
                                <img
                                    src={selectedImages[currentImageIndex]?.image}
                                    alt={`Image ${currentImageIndex + 1}`}
                                    className="gallery-main-image"
                                />
                                {selectedImages.length > 1 && (
                                    <>
                                        <button className="gallery-nav prev" onClick={prevImage}>‹</button>
                                        <button className="gallery-nav next" onClick={nextImage}>›</button>
                                    </>
                                )}
                            </div>
                            <div className="gallery-counter">
                                {currentImageIndex + 1} از {selectedImages.length}
                            </div>
                            {selectedImages.length > 1 && (
                                <div className="gallery-thumbnails">
                                    {selectedImages.map((image, index) => (
                                        <img
                                            key={index}
                                            src={image.image}
                                            alt={`Thumbnail ${index + 1}`}
                                            className={`gallery-thumbnail ${index === currentImageIndex ? 'active' : ''}`}
                                            onClick={() => setCurrentImageIndex(index)}
                                        />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </NeoBrutalistModal>
        </div>
    );
};

export default AdminAnnouncementsPage;