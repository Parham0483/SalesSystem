import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Search, Filter, Eye, Edit, UserCheck, UserX, Mail, Phone, Building,
    Star, TrendingUp, AlertCircle, CheckCircle, XCircle, Plus, Download,
    Calendar, CreditCard, Package, MoreVertical, UserPlus
} from 'lucide-react';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistDropdown from '../../component/NeoBrutalist/NeoBrutalistDropdown';
import NeoBrutalistToggle from '../../component/NeoBrutalist/NeoBrutalistToggle';
import API from '../../component/api';
import '../../styles/Admin/AdminCustomers.css';

const AdminCustomersPage = () => {
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerDetails, setCustomerDetails] = useState(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    // Filtering and Sorting State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');

    // Bulk Actions
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [showBulkActions, setShowBulkActions] = useState(false);

    // Create/Edit Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password:'',
        phone: '',
        company_name: '',
        is_dealer: false,
        dealer_commission_rate: 0,
        is_active: true
    });

    // Stats
    const [customerStats, setCustomerStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        dealers: 0,
        regular: 0,
        totalOrders: 0,
        totalRevenue: 0
    });

    const navigate = useNavigate();

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/customers/');
            console.log('👥 Admin customers fetched:', response.data);
            setCustomers(response.data);
            calculateStats(response.data);
            setError('');
        } catch (err) {
            console.error('❌ Error fetching customers:', err);
            if (err.response?.status === 401) {
                setError('نشست شما منقضی شده است. در حال انتقال به صفحه ورود...');
                setTimeout(() => handleLogout(), 2000);
            } else {
                setError('خطا در بارگیری لیست مشتریان');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    const calculateStats = (customersList) => {
        const stats = {
            total: customersList.length,
            active: customersList.filter(c => c.is_active).length,
            inactive: customersList.filter(c => !c.is_active).length,
            dealers: customersList.filter(c => c.is_dealer).length,
            regular: customersList.filter(c => !c.is_dealer && !c.is_staff).length,
            totalOrders: customersList.reduce((sum, c) => sum + (c.total_orders || 0), 0),
            totalRevenue: customersList.reduce((sum, c) => sum + (c.total_spent || 0), 0)
        };
        setCustomerStats(stats);
    };

    useEffect(() => {
        let filtered = [...customers];

        // Search filter
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.name?.toLowerCase().includes(lowercasedTerm) ||
                c.email?.toLowerCase().includes(lowercasedTerm) ||
                (c.company_name && c.company_name.toLowerCase().includes(lowercasedTerm)) ||
                (c.phone && c.phone.includes(searchTerm))
            );
        }

        // Type filter
        if (filterType !== 'all') {
            filtered = filtered.filter(c => {
                if (filterType === 'customers') return !c.is_dealer && !c.is_staff;
                if (filterType === 'dealers') return c.is_dealer;
                if (filterType === 'staff') return c.is_staff;
                return true;
            });
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(c => c.is_active === (statusFilter === 'active'));
        }

        // Sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.date_joined) - new Date(a.date_joined);
                case 'oldest':
                    return new Date(a.date_joined) - new Date(b.date_joined);
                case 'name':
                    return a.name.localeCompare(b.name, 'fa');
                case 'orders':
                    return (b.total_orders || 0) - (a.total_orders || 0);
                case 'revenue':
                    return (b.total_spent || 0) - (a.total_spent || 0);
                default:
                    return 0;
            }
        });

        setFilteredCustomers(filtered);
    }, [customers, searchTerm, filterType, statusFilter, sortBy]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    const handleToggleStatus = async (customerId, currentStatus) => {
        try {
            await API.patch(`/admin/customers/${customerId}/`, { is_active: !currentStatus });
            fetchCustomers();
        } catch (err) {
            console.error('Error toggling customer status', err);
            setError('خطا در تغییر وضعیت مشتری');
        }
    };

    const handleViewDetails = async (customer) => {
        setSelectedCustomer(customer);
        setIsModalOpen(true);
        setIsDetailLoading(true);
        try {
            const response = await API.get(`/admin/customers/${customer.id}/details/`);
            setCustomerDetails(response.data);
        } catch (err) {
            console.error('Error fetching customer details', err);
            setError('خطا در بارگیری جزئیات مشتری');
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCustomer(null);
        setCustomerDetails(null);
    };

    const handleCreateCustomer = () => {
        setFormData({
            name: '',
            email: '',
            password:'',
            phone: '',
            company_name: '',
            is_dealer: false,
            dealer_commission_rate: 0,
            is_active: true
        });
        setIsCreateModalOpen(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            await API.post('/admin/customers/', formData);
            fetchCustomers();
            setIsCreateModalOpen(false);
            setFormData({});
        } catch (err) {
            console.error('Error creating customer', err);
            setError('خطا در ایجاد مشتری جدید');
        }
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleCustomerSelect = (customerId) => {
        setSelectedCustomers(prev => {
            const newSelection = prev.includes(customerId)
                ? prev.filter(id => id !== customerId)
                : [...prev, customerId];
            setShowBulkActions(newSelection.length > 0);
            return newSelection;
        });
    };

    const handleSelectAll = () => {
        if (selectedCustomers.length === filteredCustomers.length) {
            setSelectedCustomers([]);
            setShowBulkActions(false);
        } else {
            const allIds = filteredCustomers.map(c => c.id);
            setSelectedCustomers(allIds);
            setShowBulkActions(true);
        }
    };

    const handleBulkAction = async (action) => {
        try {
            await API.post('/admin/customers/bulk-action/', {
                action,
                customer_ids: selectedCustomers
            });
            fetchCustomers();
            setSelectedCustomers([]);
            setShowBulkActions(false);
        } catch (err) {
            console.error('Error performing bulk action', err);
            setError('خطا در انجام عملیات گروهی');
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilterType('all');
        setStatusFilter('all');
        setSortBy('newest');
    };

    const filterOptions = [
        { value: 'all', label: 'همه کاربران' },
        { value: 'customers', label: 'مشتریان عادی' },
        { value: 'dealers', label: 'نمایندگان' },
        { value: 'staff', label: 'کارمندان' }
    ];

    const statusOptions = [
        { value: 'all', label: 'همه وضعیت‌ها' },
        { value: 'active', label: 'فعال' },
        { value: 'inactive', label: 'غیرفعال' }
    ];

    const sortOptions = [
        { value: 'newest', label: 'جدیدترین' },
        { value: 'oldest', label: 'قدیمی‌ترین' },
        { value: 'name', label: 'نام' },
        { value: 'orders', label: 'تعداد سفارش' },
        { value: 'revenue', label: 'مقدار خرید' }
    ];

    if (loading) {
        return (
            <div className="admin-customers-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>در حال بارگیری مشتریان...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-customers-page" dir="rtl">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="page-title">
                            <Users className="title-icon" />
                            مدیریت مشتریان
                        </h1>
                        <p className="page-subtitle">
                            {filteredCustomers.length} مشتری از مجموع {customers.length} مشتری
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="+ افزودن مشتری جدید"
                            color="green-400"
                            textColor="black"
                            onClick={handleCreateCustomer}
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
                    <NeoBrutalistCard className="stat-card total" onClick={() => { setFilterType('all'); setStatusFilter('all'); }}>
                        <div className="stat-content">
                            <Users className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{customerStats.total}</span>
                                <span className="stat-label">کل مشتریان</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card active" onClick={() => setStatusFilter('active')}>
                        <div className="stat-content">
                            <CheckCircle className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{customerStats.active}</span>
                                <span className="stat-label">فعال</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card dealers" onClick={() => setFilterType('dealers')}>
                        <div className="stat-content">
                            <Star className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{customerStats.dealers}</span>
                                <span className="stat-label">نمایندگان</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card revenue">
                        <div className="stat-content">
                            <TrendingUp className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{(customerStats.totalRevenue / 1000).toFixed(0)}K</span>
                                <span className="stat-label">فروش کل (هزار تومان)</span>
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
                            placeholder="جستجو در نام، ایمیل، شرکت یا تلفن..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <NeoBrutalistDropdown
                        label="نوع کاربر"
                        options={filterOptions}
                        value={filterType}
                        onChange={(value) => setFilterType(value)}
                    />

                    <NeoBrutalistDropdown
                        label="وضعیت"
                        options={statusOptions}
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
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
                        <span>{selectedCustomers.length} مشتری انتخاب شده</span>
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
                                text="ارسال ایمیل"
                                color="blue-400"
                                textColor="white"
                                onClick={() => handleBulkAction('email')}
                            />
                        </div>
                    </div>
                )}
            </NeoBrutalistCard>

            {/* Customer Table Header */}
            <NeoBrutalistCard className="table-header">
                <div className="table-header-content">
                    <label className="select-all-wrapper">
                        <input
                            type="checkbox"
                            checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                            onChange={handleSelectAll}
                        />
                        انتخاب همه
                    </label>
                    <span>نمایش {filteredCustomers.length} مشتری</span>
                </div>
            </NeoBrutalistCard>

            {/* Customers Grid */}
            <div className="customers-grid">
                {filteredCustomers.map(customer => (
                    <NeoBrutalistCard
                        key={customer.id}
                        className={`customer-card ${!customer.is_active ? 'inactive' : ''} ${customer.is_dealer ? 'dealer' : ''}`}
                    >
                        <div className="card-header">
                            <label className="customer-select">
                                <input
                                    type="checkbox"
                                    checked={selectedCustomers.includes(customer.id)}
                                    onChange={() => handleCustomerSelect(customer.id)}
                                />
                            </label>

                            <div className="customer-identity">
                                <h3 className="customer-name">{customer.name}</h3>
                                <span className="customer-email">
                                    <Mail size={14} />
                                    {customer.email}
                                </span>
                            </div>

                            <div className="customer-tags">
                                {customer.is_dealer && (
                                    <span className="tag dealer-tag">
                                        <Star size={12} />
                                        نماینده
                                    </span>
                                )}
                                {customer.is_staff && (
                                    <span className="tag staff-tag">
                                        <UserCheck size={12} />
                                        کارمند
                                    </span>
                                )}
                                <span className={`tag status-tag ${customer.is_active ? 'active' : 'inactive'}`}>
                                    {customer.is_active ? (
                                        <><CheckCircle size={12} /> فعال</>
                                    ) : (
                                        <><XCircle size={12} /> غیرفعال</>
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="customer-details">
                            {customer.company_name && (
                                <div className="detail-row">
                                    <Building size={16} className="detail-icon" />
                                    <span>{customer.company_name}</span>
                                </div>
                            )}

                            {customer.phone && (
                                <div className="detail-row">
                                    <Phone size={16} className="detail-icon" />
                                    <span>{customer.phone}</span>
                                </div>
                            )}

                            <div className="detail-row">
                                <span className="detail-label">عضویت:</span>
                                <span>{new Date(customer.date_joined).toLocaleDateString('fa-IR')}</span>
                            </div>

                            {customer.dealer_code && (
                                <div className="detail-row">
                                    <span className="detail-label">کد نماینده:</span>
                                    <span className="dealer-code">{customer.dealer_code}</span>
                                </div>
                            )}
                        </div>

                        <div className="customer-stats">
                            <div className="stat-item">
                                <span className="stat-number">{customer.total_orders || 0}</span>
                                <span className="stat-label">سفارش</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">{((customer.total_spent || 0) / 1000).toFixed(0)}K</span>
                                <span className="stat-label">خرید (هزار تومان)</span>
                            </div>
                            {customer.is_dealer && customer.dealer_commission_rate && (
                                <div className="stat-item">
                                    <span className="stat-number">{customer.dealer_commission_rate}%</span>
                                    <span className="stat-label">کمیسیون</span>
                                </div>
                            )}
                        </div>

                        <div className="card-actions">
                            <NeoBrutalistButton
                                text="مشاهده جزئیات"
                                color="blue-400"
                                textColor="white"
                                onClick={() => handleViewDetails(customer)}
                            />

                            <NeoBrutalistButton
                                text={customer.is_active ? "غیرفعال کردن" : "فعال کردن"}
                                color={customer.is_active ? "red-400" : "green-400"}
                                textColor={customer.is_active ? "white" : "black"}
                                onClick={() => handleToggleStatus(customer.id, customer.is_active)}
                            />
                        </div>
                    </NeoBrutalistCard>
                ))}
            </div>

            {/* Empty State */}
            {filteredCustomers.length === 0 && !loading && (
                <NeoBrutalistCard className="empty-state-card">
                    <div className="empty-content">
                        <Users size={48} className="empty-icon" />
                        <h3>مشتری یافت نشد</h3>
                        <p>
                            {customers.length === 0
                                ? 'هنوز مشتری ثبت نشده است.'
                                : 'بر اساس فیلترهای انتخاب شده، مشتری یافت نشد.'
                            }
                        </p>
                        {customers.length > 0 && (
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

            {/* Customer Detail Modal */}
            <NeoBrutalistModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={selectedCustomer ? `جزئیات مشتری: ${selectedCustomer.name}` : ''}
                size="large"
            >
                {isDetailLoading ? (
                    <div className="modal-loading">
                        <div className="loading-spinner"></div>
                        <p>در حال بارگیری جزئیات...</p>
                    </div>
                ) : customerDetails ? (
                    <div className="customer-detail-modal">
                        <NeoBrutalistCard className="detail-section">
                            <h4>اطلاعات کلی</h4>
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <label>نام:</label>
                                    <span>{customerDetails.customer?.name}</span>
                                </div>
                                <div className="detail-item">
                                    <label>ایمیل:</label>
                                    <span>{customerDetails.customer?.email}</span>
                                </div>
                                <div className="detail-item">
                                    <label>تلفن:</label>
                                    <span>{customerDetails.customer?.phone || 'ثبت نشده'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>شرکت:</label>
                                    <span>{customerDetails.customer?.company_name || 'ثبت نشده'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>تاریخ عضویت:</label>
                                    <span>{new Date(customerDetails.customer?.date_joined).toLocaleDateString('fa-IR')}</span>
                                </div>
                                <div className="detail-item">
                                    <label>آخرین ورود:</label>
                                    <span>
                                        {customerDetails.customer?.last_login
                                            ? new Date(customerDetails.customer.last_login).toLocaleDateString('fa-IR')
                                            : 'هرگز'
                                        }
                                    </span>
                                </div>
                            </div>
                        </NeoBrutalistCard>

                        <NeoBrutalistCard className="detail-section">
                            <h4>آمار خرید</h4>
                            <div className="stats-row">
                                <div className="modal-stat-item">
                                    <span className="modal-stat-number">{customerDetails.total_orders || 0}</span>
                                    <span className="modal-stat-label">کل سفارشات</span>
                                </div>
                                <div className="modal-stat-item">
                                    <span className="modal-stat-number">{(customerDetails.total_spent || 0).toLocaleString('fa-IR')}</span>
                                    <span className="modal-stat-label">کل خرید (تومان)</span>
                                </div>
                            </div>
                        </NeoBrutalistCard>
                        <NeoBrutalistCard className="detail-section orders-section">
                            <h4>آخرین سفارشات</h4>
                            {customerDetails.orders?.length > 0 ? (
                                <div className="orders-container">
                                    <div className="orders-list-scrollable">
                                        {customerDetails.orders.map(order => (
                                            <div key={order.id} className="order-item">
                                                <span className="order-id">سفارش #{order.id}</span>
                                                <span className="order-date">
                            {new Date(order.created_at).toLocaleDateString('fa-IR')}
                        </span>
                                                <span className={`order-status ${order.status}`}>
                            {order.status === 'completed' ? 'تکمیل شده' :
                                order.status === 'pending_pricing' ? 'در انتظار قیمت' :
                                    order.status === 'confirmed' ? 'تایید شده' : order.status}
                        </span>
                                                {order.total > 0 && (
                                                    <span className="order-total">
                                {order.total.toLocaleString('fa-IR')} تومان
                            </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="no-orders">هنوز سفارشی ثبت نکرده است.</p>
                            )}
                        </NeoBrutalistCard>
                    </div>
                ) : (
                    <p>اطلاعاتی برای نمایش وجود ندارد.</p>
                )}
            </NeoBrutalistModal>

            {/* Create Customer Modal */}
            <NeoBrutalistModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="افزودن مشتری جدید"
            >
                <form onSubmit={handleFormSubmit} className="customer-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>نام کامل *</label>
                            <NeoBrutalistInput
                                name="name"
                                value={formData.name}
                                onChange={handleFormChange}
                                placeholder="نام و نام خانوادگی"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>ایمیل *</label>
                            <NeoBrutalistInput
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleFormChange}
                                placeholder="example@company.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>رمز عبور *</label>
                        <NeoBrutalistInput
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleFormChange}
                            placeholder="حداقل 8 کاراکتر شامل حروف و اعداد"
                            required
                        />
                        <small className="form-help">
                            رمز عبور باید حداقل 8 کاراکتر و شامل حروف و اعداد باشد
                        </small>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>شماره تلفن</label>
                            <NeoBrutalistInput
                                name="phone"
                                value={formData.phone}
                                onChange={handleFormChange}
                                placeholder="09123456789"
                            />
                        </div>
                        <div className="form-group">
                            <label>نام شرکت</label>
                            <NeoBrutalistInput
                                name="company_name"
                                value={formData.company_name}
                                onChange={handleFormChange}
                                placeholder="نام شرکت (اختیاری)"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <NeoBrutalistToggle
                                checked={formData.is_dealer}
                                onChange={(e) => setFormData(prev => ({ ...prev, is_dealer: e.target.checked }))}
                                label="نماینده فروش"
                            />
                        </div>
                        {formData.is_dealer && (
                            <div className="form-group">
                                <label>نرخ کمیسیون (%)</label>
                                <NeoBrutalistInput
                                    type="number"
                                    name="dealer_commission_rate"
                                    value={formData.dealer_commission_rate}
                                    onChange={handleFormChange}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    placeholder="5.0"
                                />
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <NeoBrutalistToggle
                            checked={formData.is_active}
                            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                            label="حساب فعال"
                        />
                    </div>

                    <div className="form-actions">
                        <NeoBrutalistButton
                            text="لغو"
                            color="gray-400"
                            textColor="black"
                            onClick={() => setIsCreateModalOpen(false)}
                            type="button"
                        />
                        <NeoBrutalistButton
                            text="ایجاد مشتری"
                            color="green-400"
                            textColor="black"
                            type="submit"
                        />
                    </div>
                </form>
            </NeoBrutalistModal>
        </div>
    );
};

export default AdminCustomersPage;