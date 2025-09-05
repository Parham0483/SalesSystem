// frontend/src/pages/admin/AdminDealersPage.js - Updated with Enhanced Performance Modal
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Search, Filter, Eye, Edit, UserCheck, UserX, Mail, Phone, Building,
    Star, TrendingUp, AlertCircle, CheckCircle, XCircle, Plus, Download,
    Calendar, CreditCard, Package, MoreVertical, UserPlus, DollarSign,
    Shield, Crown, Settings, PieChart, BarChart3, Handshake, ArrowLeft,
    Activity, Clock, SortAsc, SortDesc, ExternalLink, User
} from 'lucide-react';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistDropdown from '../../component/NeoBrutalist/NeoBrutalistDropdown';
import NeoBrutalistToggle from '../../component/NeoBrutalist/NeoBrutalistToggle';
import API from '../../component/api';
import '../../styles/Admin/AdminDealersPage.css'

const AdminDealersPage = () => {
    const [dealers, setDealers] = useState([]);
    const [filteredDealers, setFilteredDealers] = useState([]);
    const [commissions, setCommissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreateAdminModalOpen, setIsCreateAdminModalOpen] = useState(false);
    const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
    const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
    const [selectedDealer, setSelectedDealer] = useState(null);

    // Enhanced Performance Modal States
    const [dealerPerformanceData, setDealerPerformanceData] = useState(null);
    const [performanceCurrentView, setPerformanceCurrentView] = useState('overview');
    const [performanceLoading, setPerformanceLoading] = useState(false);
    const [topCustomers, setTopCustomers] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [monthlyStats, setMonthlyStats] = useState([]);

    // Customer Orders Modal States
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerOrdersOpen, setCustomerOrdersOpen] = useState(false);
    const [customerOrders, setCustomerOrders] = useState([]);

    // Order Details Modal States
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
    const [orderDetails, setOrderDetails] = useState(null);

    // Search and Filter States for Performance Modal
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [customerSortBy, setCustomerSortBy] = useState('total_spent');
    const [customerSortOrder, setCustomerSortOrder] = useState('desc');

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [commissionFilter, setCommissionFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [viewMode, setViewMode] = useState('dealers'); // 'dealers', 'commissions', 'reports'

    // Form States
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        company_name: '',
        commission_rate: 5.0,
        is_active: true
    });

    const [adminFormData, setAdminFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        is_superuser: false,
        is_active: true
    });

    const [dealerStats, setDealerStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        total_commission: 0,
        paid_commission: 0,
        pending_commission: 0,
        orders_assigned: 0
    });

    const navigate = useNavigate();

    // Filter Options
    const statusOptions = [
        { value: 'all', label: 'همه وضعیت‌ها' },
        { value: 'active', label: 'فعال' },
        { value: 'inactive', label: 'غیرفعال' }
    ];

    const commissionOptions = [
        { value: 'all', label: 'همه کمیسیون‌ها' },
        { value: 'paid', label: 'پرداخت شده' },
        { value: 'unpaid', label: 'پرداخت نشده' }
    ];

    const sortOptions = [
        { value: 'newest', label: 'جدیدترین' },
        { value: 'oldest', label: 'قدیمی‌ترین' },
        { value: 'name', label: 'نام' },
        { value: 'commission', label: 'نرخ کمیسیون' },
        { value: 'orders', label: 'تعداد سفارش' }
    ];

    const fetchDealers = useCallback(async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/dealers/');
            setDealers(response.data);
            setError('');
        } catch (err) {
            console.error('Error fetching dealers:', err);
            if (err.response?.status === 401) {
                setError('نشست شما منقضی شده است. در حال انتقال به صفحه ورود...');
                setTimeout(() => handleLogout(), 2000);
            } else {
                setError('خطا در بارگیری نمایندگان');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchCommissions = useCallback(async () => {
        try {
            const response = await API.get('/admin/dealers/commissions/');
            setCommissions(response.data);
        } catch (err) {
            console.error('Error fetching commissions:', err);
        }
    }, []);

    const fetchDealerStats = useCallback(async () => {
        try {
            const response = await API.get('/admin/dashboard/stats/dealers/');
            setDealerStats(response.data);
        } catch (err) {
            console.error('Error fetching dealer stats:', err);
        }
    }, []);

    // Enhanced Performance Data Fetching
    const fetchDealerPerformance = async (dealerId) => {
        setPerformanceLoading(true);
        try {
            const response = await API.get(`/admin/dealers/${dealerId}/performance/`);
            setDealerPerformanceData(response.data);
        } catch (err) {
            console.error('Error fetching dealer performance:', err);
            setError('خطا در بارگیری آمار عملکرد');
        } finally {
            setPerformanceLoading(false);
        }
    };

    const fetchTopCustomers = async (dealerId) => {
        try {
            const params = new URLSearchParams({
                search: customerSearchTerm,
                sort_by: customerSortBy,
                order: customerSortOrder
            });
            const response = await API.get(`/admin/dealers/${dealerId}/customers/?${params}`);
            setTopCustomers(response.data.results);
        } catch (err) {
            console.error('Error fetching top customers:', err);
        }
    };

    const fetchRecentOrders = async (dealerId) => {
        try {
            const response = await API.get(`/admin/dealers/${dealerId}/recent-orders/?limit=10`);
            setRecentOrders(response.data.results);
        } catch (err) {
            console.error('Error fetching recent orders:', err);
        }
    };

    const fetchMonthlyStats = async (dealerId) => {
        try {
            const response = await API.get(`/admin/dealers/${dealerId}/monthly-stats/?year=2024`);
            setMonthlyStats(response.data.monthly_stats);
        } catch (err) {
            console.error('Error fetching monthly stats:', err);
        }
    };

    const fetchCustomerOrders = async (customerId, dealerId) => {
        try {
            const params = dealerId ? `?dealer_id=${dealerId}` : '';
            const response = await API.get(`/admin/customers/${customerId}/orders/${params}`);
            setCustomerOrders(response.data.results);
        } catch (err) {
            console.error('Error fetching customer orders:', err);
        }
    };

    const fetchOrderDetails = async (orderId) => {
        try {
            const response = await API.get(`/admin/orders/${orderId}/details/`);
            setOrderDetails(response.data);
        } catch (err) {
            console.error('Error fetching order details:', err);
        }
    };

    useEffect(() => {
        fetchDealers();
        fetchCommissions();
        fetchDealerStats();
    }, [fetchDealers, fetchCommissions, fetchDealerStats]);

    useEffect(() => {
        filterAndSortDealers();
    }, [dealers, searchTerm, statusFilter, sortBy]);

    // Enhanced Performance Modal Effects
    useEffect(() => {
        if (selectedDealer && isPerformanceModalOpen) {
            fetchDealerPerformance(selectedDealer.id);
            if (performanceCurrentView === 'customers') {
                fetchTopCustomers(selectedDealer.id);
            } else if (performanceCurrentView === 'orders') {
                fetchRecentOrders(selectedDealer.id);
            } else if (performanceCurrentView === 'analytics') {
                fetchMonthlyStats(selectedDealer.id);
            }
        }
    }, [selectedDealer, isPerformanceModalOpen, performanceCurrentView]);

    useEffect(() => {
        if (selectedDealer && performanceCurrentView === 'customers') {
            fetchTopCustomers(selectedDealer.id);
        }
    }, [customerSearchTerm, customerSortBy, customerSortOrder, selectedDealer, performanceCurrentView]);

    useEffect(() => {
        // Prevent body scroll when modal is open
        if (isPerformanceModalOpen) {
            document.body.classList.add('modal-open');
            document.body.style.overflow = 'hidden';
        } else {
            document.body.classList.remove('modal-open');
            document.body.style.overflow = 'unset';
        }

        // Cleanup on unmount
        return () => {
            document.body.classList.remove('modal-open');
            document.body.style.overflow = 'unset';
        };
    }, [isPerformanceModalOpen]);

    const filterAndSortDealers = () => {
        let filtered = [...dealers];

        // Search filter
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(dealer =>
                dealer.name?.toLowerCase().includes(lowercasedTerm) ||
                dealer.email?.toLowerCase().includes(lowercasedTerm) ||
                dealer.company_name?.toLowerCase().includes(lowercasedTerm) ||
                dealer.dealer_code?.toLowerCase().includes(lowercasedTerm)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(dealer => dealer.is_active === (statusFilter === 'active'));
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
                case 'commission':
                    return (b.dealer_commission_rate || 0) - (a.dealer_commission_rate || 0);
                case 'orders':
                    return (b.assigned_orders_count || 0) - (a.assigned_orders_count || 0);
                default:
                    return 0;
            }
        });

        setFilteredDealers(filtered);
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    const handleCreateDealer = async (e) => {
        e.preventDefault();
        try {
            await API.post('/admin/dealers/create/', formData);
            fetchDealers();
            fetchDealerStats();
            setIsCreateModalOpen(false);
            setFormData({
                name: '',
                email: '',
                password: '',
                phone: '',
                company_name: '',
                commission_rate: 5.0,
                is_active: true
            });
        } catch (err) {
            console.error('Error creating dealer:', err);
            setError('خطا در ایجاد نماینده جدید');
        }
    };

    const handleCreateAdmin = async (e) => {
        e.preventDefault();
        try {
            const adminData = {
                ...adminFormData,
                is_staff: true,
                is_dealer: false
            };
            await API.post('/admin/customers/', adminData);
            setIsCreateAdminModalOpen(false);
            setAdminFormData({
                name: '',
                email: '',
                password: '',
                phone: '',
                is_superuser: false,
                is_active: true
            });
        } catch (err) {
            console.error('Error creating admin:', err);
            setError('خطا در ایجاد ادمین جدید');
        }
    };

    const handleUpdateCommission = async (dealerId, newRate) => {
        try {
            await API.post(`/admin/dealers/${dealerId}/update-commission/`, {
                commission_rate: newRate
            });
            fetchDealers();
        } catch (err) {
            console.error('Error updating commission:', err);
            setError('خطا در به‌روزرسانی نرخ کمیسیون');
        }
    };

    const handleToggleStatus = async (dealerId, currentStatus) => {
        try {
            await API.patch(`/admin/customers/${dealerId}/`, { is_active: !currentStatus });
            fetchDealers();
        } catch (err) {
            console.error('Error toggling dealer status:', err);
            setError('خطا در تغییر وضعیت نماینده');
        }
    };

    const handleViewPerformance = (dealer) => {
        setSelectedDealer(dealer);
        setPerformanceCurrentView('overview');
        setDealerPerformanceData(null);
        setTopCustomers([]);
        setRecentOrders([]);
        setMonthlyStats([]);
        setIsPerformanceModalOpen(true);
    };

    const handleCustomerClick = (customer) => {
        setSelectedCustomer(customer);
        setCustomerOrders([]);
        setCustomerOrdersOpen(true);
        fetchCustomerOrders(customer.id, selectedDealer?.id);
    };

    const handleOrderClick = (order) => {
        let orderId = order.id;
        if (typeof orderId === 'string' && orderId.startsWith('ORD-')) {
            orderId = orderId.replace('ORD-', '');
        }

        setSelectedOrder(order);
        setOrderDetails(null);
        setOrderDetailsOpen(true);
        fetchOrderDetails(orderId);
    };

    const handlePayCommissions = async (commissionIds) => {
        try {
            await API.post('/admin/dealers/pay-commissions/', {
                commission_ids: commissionIds,
                payment_reference: `PAY-${Date.now()}`
            });
            fetchCommissions();
            fetchDealerStats();
        } catch (err) {
            console.error('Error paying commissions:', err);
            setError('خطا در پرداخت کمیسیون‌ها');
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setSortBy('newest');
    };

    if (loading) {
        return (
            <div className="admin-dealers-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>در حال بارگیری نمایندگان...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-dealers-page" dir="rtl">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="page-title">
                            <Handshake className="title-icon" />
                            مدیریت نمایندگان و کمیسیون‌ها
                        </h1>
                        <p className="page-subtitle">
                            {filteredDealers.length} نماینده از مجموع {dealers.length} نماینده
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="+ افزودن نماینده جدید"
                            color="green-400"
                            textColor="black"
                            onClick={() => setIsCreateModalOpen(true)}
                        />
                        <NeoBrutalistButton
                            text="+ ایجاد ادمین جدید"
                            color="purple-400"
                            textColor="white"
                            onClick={() => setIsCreateAdminModalOpen(true)}
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

            {/* View Mode Tabs */}
            <div className="view-mode-tabs">
                <NeoBrutalistButton
                    text="نمایندگان"
                    color={viewMode === 'dealers' ? 'blue-400' : 'gray-200'}
                    textColor={viewMode === 'dealers' ? 'white' : 'black'}
                    onClick={() => setViewMode('dealers')}
                />
                <NeoBrutalistButton
                    text="کمیسیون‌ها"
                    color={viewMode === 'commissions' ? 'blue-400' : 'gray-200'}
                    textColor={viewMode === 'commissions' ? 'white' : 'black'}
                    onClick={() => setViewMode('commissions')}
                />
                <NeoBrutalistButton
                    text="گزارشات"
                    color={viewMode === 'reports' ? 'blue-400' : 'gray-200'}
                    textColor={viewMode === 'reports' ? 'white' : 'black'}
                    onClick={() => setViewMode('reports')}
                />
            </div>

            {/* Statistics Cards */}
            <div className="stats-section">
                <div className="stats-grid">
                    <NeoBrutalistCard className="stat-card total" onClick={() => setStatusFilter('all')}>
                        <div className="stat-content">
                            <Handshake className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{dealerStats.total_dealers || 0}</span>
                                <span className="stat-label">کل نمایندگان</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card active" onClick={() => setStatusFilter('active')}>
                        <div className="stat-content">
                            <CheckCircle className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{dealerStats.active_dealers || 0}</span>
                                <span className="stat-label">فعال</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card orders">
                        <div className="stat-content">
                            <Package className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{dealerStats.orders_assigned || 0}</span>
                                <span className="stat-label">سفارشات تخصیص یافته</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card commission">
                        <div className="stat-content">
                            <DollarSign className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{((dealerStats.total_commission || 0) / 1000).toFixed(0)}K</span>
                                <span className="stat-label">کل کمیسیون (هزار تومان)</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>
                </div>
            </div>

            {/* Dealers View */}
            {viewMode === 'dealers' && (
                <>
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
                                    placeholder="جستجو در نام، ایمیل، شرکت یا کد نماینده..."
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
                                label="مرتب‌سازی"
                                options={sortOptions}
                                value={sortBy}
                                onChange={(value) => setSortBy(value)}
                            />
                        </div>
                    </NeoBrutalistCard>

                    {/* Dealers Grid */}
                    <div className="dealers-grid">
                        {filteredDealers.map(dealer => (
                            <NeoBrutalistCard
                                key={dealer.id}
                                className={`dealer-card ${!dealer.is_active ? 'inactive' : ''}`}
                            >
                                <div className="card-header">
                                    <div className="dealer-identity">
                                        <h3 className="dealer-name">{dealer.name}</h3>
                                        <span className="dealer-email">
                                            <Mail size={14} />
                                            {dealer.email}
                                        </span>
                                        {dealer.dealer_code && (
                                            <span className="dealer-code">
                                                کد: {dealer.dealer_code}
                                            </span>
                                        )}
                                    </div>

                                    <div className="dealer-tags">
                                        <span className={`tag status-tag ${dealer.is_active ? 'active' : 'inactive'}`}>
                                            {dealer.is_active ? (
                                                <><CheckCircle size={12} /> فعال</>
                                            ) : (
                                                <><XCircle size={12} /> غیرفعال</>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                <div className="dealer-details">
                                    {dealer.company_name && (
                                        <div className="detail-row">
                                            <Building size={16} className="detail-icon" />
                                            <span>{dealer.company_name}</span>
                                        </div>
                                    )}

                                    {dealer.phone && (
                                        <div className="detail-row">
                                            <Phone size={16} className="detail-icon" />
                                            <span>{dealer.phone}</span>
                                        </div>
                                    )}

                                    <div className="detail-row">
                                        <span className="detail-label">عضویت:</span>
                                        <span>{new Date(dealer.date_joined).toLocaleDateString('fa-IR')}</span>
                                    </div>

                                    <div className="detail-row">
                                        <DollarSign size={16} className="detail-icon" />
                                        <span>نرخ کمیسیون: {dealer.dealer_commission_rate}%</span>
                                    </div>
                                </div>

                                <div className="dealer-stats">
                                    <div className="stat-item">
                                        <span className="stat-number">{dealer.assigned_orders_count || 0}</span>
                                        <span className="stat-label">سفارش تخصیص یافته</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-number">{((dealer.total_commission_earned || 0) / 1000).toFixed(0)}K</span>
                                        <span className="stat-label">کمیسیون کسب شده</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-number">{((dealer.pending_commission || 0) / 1000).toFixed(0)}K</span>
                                        <span className="stat-label">کمیسیون در انتظار</span>
                                    </div>
                                </div>

                                <div className="card-actions">
                                    <NeoBrutalistButton
                                        text="آمار عملکرد"
                                        color="blue-400"
                                        textColor="white"
                                        onClick={() => handleViewPerformance(dealer)}
                                    />

                                    <NeoBrutalistButton
                                        text="ویرایش کمیسیون"
                                        color="yellow-400"
                                        textColor="black"
                                        onClick={() => {
                                            const newRate = prompt('نرخ کمیسیون جدید (درصد):', dealer.dealer_commission_rate);
                                            if (newRate && !isNaN(newRate)) {
                                                handleUpdateCommission(dealer.id, parseFloat(newRate));
                                            }
                                        }}
                                    />

                                    <NeoBrutalistButton
                                        text={dealer.is_active ? "غیرفعال کردن" : "فعال کردن"}
                                        color={dealer.is_active ? "red-400" : "green-400"}
                                        textColor={dealer.is_active ? "white" : "black"}
                                        onClick={() => handleToggleStatus(dealer.id, dealer.is_active)}
                                    />
                                </div>
                            </NeoBrutalistCard>
                        ))}
                    </div>
                </>
            )}

            {/* Commissions View */}
            {viewMode === 'commissions' && (
                <>
                    <NeoBrutalistCard className="commissions-card">
                        <div className="commissions-header">
                            <h3>
                                <DollarSign size={20} />
                                مدیریت کمیسیون‌ها
                            </h3>
                            <div className="commission-summary">
                                <span>کل: {((dealerStats.total_commission || 0) / 1000).toFixed(0)}K تومان</span>
                                <span>پرداخت شده: {((dealerStats.paid_commission || 0) / 1000).toFixed(0)}K تومان</span>
                                <span>در انتظار: {((dealerStats.pending_commission || 0) / 1000).toFixed(0)}K تومان</span>
                            </div>
                        </div>

                        <div className="commissions-list">
                            {commissions.map(commission => (
                                <div key={commission.id} className={`commission-item ${commission.is_paid ? 'paid' : 'unpaid'}`}>
                                    <div className="commission-info">
                                        <span className="dealer-name">{commission.dealer_name}</span>
                                        <span className="order-link">سفارش #{commission.order}</span>
                                        <span className="commission-amount">{commission.commission_amount.toLocaleString('fa-IR')} تومان</span>
                                        <span className="commission-rate">{commission.commission_rate}%</span>
                                    </div>
                                    <div className="commission-status">
                                        {commission.is_paid ? (
                                            <span className="status-paid">
                                                <CheckCircle size={16} />
                                                پرداخت شده در {new Date(commission.paid_at).toLocaleDateString('fa-IR')}
                                            </span>
                                        ) : (
                                            <NeoBrutalistButton
                                                text="پرداخت"
                                                color="green-400"
                                                textColor="black"
                                                onClick={() => handlePayCommissions([commission.id])}
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </NeoBrutalistCard>
                </>
            )}

            {/* Reports View */}
            {viewMode === 'reports' && (
                <>
                    <div className="reports-grid">
                        <NeoBrutalistCard className="report-card">
                            <h3>
                                <BarChart3 size={20} />
                                گزارش فروش نمایندگان
                            </h3>
                            <div className="report-content">
                                <p>گزارش جامع عملکرد فروش تمام نمایندگان</p>
                                <NeoBrutalistButton
                                    text="مشاهده گزارش"
                                    color="blue-400"
                                    textColor="white"
                                    onClick={() => {
                                        navigate('/admin/reports/dealer-sales');
                                    }}
                                />
                            </div>
                        </NeoBrutalistCard>

                        <NeoBrutalistCard className="report-card">
                            <h3>
                                <PieChart size={20} />
                                تحلیل کمیسیون‌ها
                            </h3>
                            <div className="report-content">
                                <p>تحلیل و بررسی کمیسیون‌های پرداختی</p>
                                <NeoBrutalistButton
                                    text="مشاهده تحلیل"
                                    color="purple-400"
                                    textColor="white"
                                    onClick={() => {
                                        navigate('/admin/reports/commission-analysis');
                                    }}
                                />
                            </div>
                        </NeoBrutalistCard>

                        <NeoBrutalistCard className="report-card">
                            <h3>
                                <Download size={20} />
                                خروجی Excel
                            </h3>
                            <div className="report-content">
                                <p>دریافت گزارش کامل در فرمت Excel</p>
                                <NeoBrutalistButton
                                    text="دانلود گزارش"
                                    color="green-400"
                                    textColor="black"
                                    onClick={() => {
                                        window.open('/api/admin/dealers/export/', '_blank');
                                    }}
                                />
                            </div>
                        </NeoBrutalistCard>
                    </div>
                </>
            )}

            {/* Empty State */}
            {filteredDealers.length === 0 && !loading && viewMode === 'dealers' && (
                <NeoBrutalistCard className="empty-state-card">
                    <div className="empty-content">
                        <Handshake size={48} className="empty-icon" />
                        <h3>نماینده‌ای یافت نشد</h3>
                        <p>
                            {dealers.length === 0
                                ? 'هنوز نماینده‌ای ثبت نشده است.'
                                : 'بر اساس فیلترهای انتخاب شده، نماینده‌ای یافت نشد.'
                            }
                        </p>
                        {dealers.length === 0 ? (
                            <NeoBrutalistButton
                                text="افزودن نماینده جدید"
                                color="green-400"
                                textColor="black"
                                onClick={() => setIsCreateModalOpen(true)}
                            />
                        ) : (
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

            {/* Create Dealer Modal */}
            <NeoBrutalistModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="افزودن نماینده جدید"
            >
                <form onSubmit={handleCreateDealer} className="dealer-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>نام کامل *</label>
                            <NeoBrutalistInput
                                name="name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="نام و نام خانوادگی نماینده"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>ایمیل *</label>
                            <NeoBrutalistInput
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="dealer@company.com"
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
                            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="حداقل 8 کاراکتر شامل حروف و اعداد"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>شماره تلفن</label>
                            <NeoBrutalistInput
                                name="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="09123456789"
                            />
                        </div>
                        <div className="form-group">
                            <label>نام شرکت</label>
                            <NeoBrutalistInput
                                name="company_name"
                                value={formData.company_name}
                                onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                                placeholder="نام شرکت نماینده (اختیاری)"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>نرخ کمیسیون (%) *</label>
                            <NeoBrutalistInput
                                type="number"
                                name="commission_rate"
                                value={formData.commission_rate}
                                onChange={(e) => setFormData(prev => ({ ...prev, commission_rate: parseFloat(e.target.value) || 0 }))}
                                min="0"
                                max="50"
                                step="0.1"
                                placeholder="5.0"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <NeoBrutalistToggle
                                checked={formData.is_active}
                                onChange={(e) => {
                                    const checked = e?.target?.checked ?? e;
                                    setFormData(prev => ({ ...prev, is_active: checked }));
                                }}
                                label="حساب فعال"
                            />
                        </div>
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
                            text="ایجاد نماینده"
                            color="green-400"
                            textColor="black"
                            type="submit"
                        />
                    </div>
                </form>
            </NeoBrutalistModal>

            {/* Create Admin Modal */}
            <NeoBrutalistModal
                isOpen={isCreateAdminModalOpen}
                onClose={() => setIsCreateAdminModalOpen(false)}
                title="ایجاد ادمین جدید"
            >
                <form onSubmit={handleCreateAdmin} className="admin-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>نام کامل *</label>
                            <NeoBrutalistInput
                                name="name"
                                value={adminFormData.name}
                                onChange={(e) => setAdminFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="نام و نام خانوادگی ادمین"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>ایمیل *</label>
                            <NeoBrutalistInput
                                type="email"
                                name="email"
                                value={adminFormData.email}
                                onChange={(e) => setAdminFormData(prev => ({ ...prev, email: e.target.value }))}
                                placeholder="admin@company.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>رمز عبور *</label>
                        <NeoBrutalistInput
                            type="password"
                            name="password"
                            value={adminFormData.password}
                            onChange={(e) => setAdminFormData(prev => ({ ...prev, password: e.target.value }))}
                            placeholder="حداقل 8 کاراکتر شامل حروف و اعداد"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>شماره تلفن</label>
                            <NeoBrutalistInput
                                name="phone"
                                value={adminFormData.phone}
                                onChange={(e) => setAdminFormData(prev => ({ ...prev, phone: e.target.value }))}
                                placeholder="09123456789"
                            />
                        </div>
                        <div className="form-group">
                            <NeoBrutalistToggle
                                checked={adminFormData.is_superuser}
                                onChange={(e) => {
                                    const checked = e?.target?.checked ?? e;
                                    setAdminFormData(prev => ({ ...prev, is_superuser: checked }));
                                }}
                                label="سوپر ادمین (دسترسی کامل)"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <NeoBrutalistToggle
                            checked={adminFormData.is_active}
                            onChange={(e) => {
                                const checked = e?.target?.checked ?? e;
                                setAdminFormData(prev => ({ ...prev, is_active: checked }));
                            }}
                            label="حساب فعال"
                        />
                    </div>

                    <div className="admin-permissions-info">
                        <h4>
                            <Shield size={16} />
                            اطلاعات دسترسی‌ها:
                        </h4>
                        <ul>
                            <li>✓ دسترسی به پنل مدیریت</li>
                            <li>✓ مدیریت سفارشات و قیمت‌گذاری</li>
                            <li>✓ مدیریت محصولات</li>
                            <li>✓ مشاهده گزارشات</li>
                            {adminFormData.is_superuser && (
                                <>
                                    <li>✓ <strong>مدیریت کاربران و نمایندگان</strong></li>
                                    <li>✓ <strong>تنظیمات سیستم</strong></li>
                                    <li>✓ <strong>دسترسی کامل Django Admin</strong></li>
                                </>
                            )}
                        </ul>
                    </div>

                    <div className="form-actions">
                        <NeoBrutalistButton
                            text="لغو"
                            color="gray-400"
                            textColor="black"
                            onClick={() => setIsCreateAdminModalOpen(false)}
                            type="button"
                        />
                        <NeoBrutalistButton
                            text="ایجاد ادمین"
                            color="purple-400"
                            textColor="white"
                            type="submit"
                        />
                    </div>
                </form>
            </NeoBrutalistModal>

            {/* Enhanced Dealer Performance Modal */}
            <NeoBrutalistModal
                isOpen={isPerformanceModalOpen}
                onClose={() => {
                    setIsPerformanceModalOpen(false);
                    // Reset scroll position when closing
                    document.body.style.overflow = 'unset';
                }}
                title=""
                size="fullscreen"
                className="enhanced-performance-modal"
            >
                <div className="enhanced-performance-content">
                    {selectedDealer && (
                        <>
                            {/* Header */}
                            <div className="performance-header">
                                <div className="header-info">
                                    <h2>آمار عملکرد: {selectedDealer.name}</h2>
                                    <div className="dealer-meta">
                                        <span>شرکت: {selectedDealer.company_name || 'نامشخص'}</span>
                                        <span>عضویت: {new Date(selectedDealer.date_joined).toLocaleDateString('fa-IR')}</span>
                                        <span>نرخ کمیسیون: {selectedDealer.dealer_commission_rate}%</span>
                                    </div>
                                </div>
                                <NeoBrutalistButton
                                    text="بازگشت"
                                    color="red-400"
                                    textColor="white"
                                    onClick={() => {
                                        setIsPerformanceModalOpen(false);
                                        document.body.style.overflow = 'unset';
                                    }}
                                />
                            </div>

                            {/* Navigation Tabs */}
                            <div className="performance-tabs">
                                <NeoBrutalistButton
                                    text="نمای کلی"
                                    color={performanceCurrentView === 'overview' ? 'blue-400' : 'gray-200'}
                                    textColor={performanceCurrentView === 'overview' ? 'white' : 'black'}
                                    onClick={() => setPerformanceCurrentView('overview')}
                                />
                                <NeoBrutalistButton
                                    text="مشتریان برتر"
                                    color={performanceCurrentView === 'customers' ? 'blue-400' : 'gray-200'}
                                    textColor={performanceCurrentView === 'customers' ? 'white' : 'black'}
                                    onClick={() => setPerformanceCurrentView('customers')}
                                />
                                <NeoBrutalistButton
                                    text="سفارشات اخیر"
                                    color={performanceCurrentView === 'orders' ? 'blue-400' : 'gray-200'}
                                    textColor={performanceCurrentView === 'orders' ? 'white' : 'black'}
                                    onClick={() => setPerformanceCurrentView('orders')}
                                />
                                <NeoBrutalistButton
                                    text="تحلیل عملکرد"
                                    color={performanceCurrentView === 'analytics' ? 'blue-400' : 'gray-200'}
                                    textColor={performanceCurrentView === 'analytics' ? 'white' : 'black'}
                                    onClick={() => setPerformanceCurrentView('analytics')}
                                />
                            </div>

                            {/* Content Area with Proper Scrolling */}
                            <div className="performance-content" style={{
                                height: 'calc(100vh - 280px)', // Adjust based on header + tabs height
                                overflowY: 'auto',
                                overflowX: 'hidden'
                            }}>
                                {performanceLoading ? (
                                    <div className="loading-container">
                                        <div className="loading-spinner"></div>
                                        <p>در حال بارگیری آمار عملکرد...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Overview Content */}
                                        {performanceCurrentView === 'overview' && dealerPerformanceData && (
                                            <div className="overview-content" style={{ minHeight: '0', height: 'auto' }}>
                                                {/* Key Stats */}
                                                <div className="performance-stats-grid">
                                                    <NeoBrutalistCard className="performance-stat-card">
                                                        <div className="stat-content">
                                                            <Package className="stat-icon" />
                                                            <div className="stat-info">
                                                                <span className="stat-number">{dealerPerformanceData.overview.total_orders}</span>
                                                                <span className="stat-label">کل سفارشات</span>
                                                                <span className="stat-subtitle">{dealerPerformanceData.overview.completed_orders} تکمیل شده</span>
                                                            </div>
                                                        </div>
                                                    </NeoBrutalistCard>

                                                    <NeoBrutalistCard className="performance-stat-card">
                                                        <div className="stat-content">
                                                            <DollarSign className="stat-icon" />
                                                            <div className="stat-info">
                                                                <span className="stat-number">{(dealerPerformanceData.overview.total_sales / 1000000).toFixed(1)}M</span>
                                                                <span className="stat-label">فروش کل</span>
                                                                <span className="stat-subtitle">میلیون تومان</span>
                                                            </div>
                                                        </div>
                                                    </NeoBrutalistCard>

                                                    <NeoBrutalistCard className="performance-stat-card">
                                                        <div className="stat-content">
                                                            <TrendingUp className="stat-icon" />
                                                            <div className="stat-info">
                                                                <span className="stat-number">{dealerPerformanceData.overview.conversion_rate}%</span>
                                                                <span className="stat-label">نرخ تبدیل</span>
                                                                <span className="stat-subtitle">موفقیت در فروش</span>
                                                            </div>
                                                        </div>
                                                    </NeoBrutalistCard>

                                                    <NeoBrutalistCard className="performance-stat-card">
                                                        <div className="stat-content">
                                                            <Users className="stat-icon" />
                                                            <div className="stat-info">
                                                                <span className="stat-number">{dealerPerformanceData.overview.customer_retention_rate}%</span>
                                                                <span className="stat-label">بازگشت مشتری</span>
                                                                <span className="stat-subtitle">وفاداری مشتری</span>
                                                            </div>
                                                        </div>
                                                    </NeoBrutalistCard>
                                                </div>

                                                {/* Commission Overview */}
                                                <NeoBrutalistCard className="commission-overview-card">
                                                    <h4>وضعیت کمیسیون</h4>
                                                    <div className="commission-stats-grid">
                                                        <div className="commission-stat total">
                                                            <span className="amount">{dealerPerformanceData.overview.total_commission_earned.toLocaleString('fa-IR')}</span>
                                                            <span className="label">کل کمیسیون (تومان)</span>
                                                        </div>
                                                        <div className="commission-stat paid">
                                                            <span className="amount">{dealerPerformanceData.overview.paid_commission.toLocaleString('fa-IR')}</span>
                                                            <span className="label">پرداخت شده (تومان)</span>
                                                        </div>
                                                        <div className="commission-stat pending">
                                                            <span className="amount">{dealerPerformanceData.overview.pending_commission.toLocaleString('fa-IR')}</span>
                                                            <span className="label">در انتظار (تومان)</span>
                                                        </div>
                                                    </div>
                                                </NeoBrutalistCard>

                                                {/* Quick Actions */}
                                                <NeoBrutalistCard className="quick-actions-card">
                                                    <h4>عملیات سریع</h4>
                                                    <div className="quick-actions-grid">
                                                        <NeoBrutalistButton
                                                            text="مشتریان برتر"
                                                            color="blue-400"
                                                            textColor="white"
                                                            onClick={() => setPerformanceCurrentView('customers')}
                                                        />
                                                        <NeoBrutalistButton
                                                            text="سفارشات اخیر"
                                                            color="green-400"
                                                            textColor="black"
                                                            onClick={() => setPerformanceCurrentView('orders')}
                                                        />
                                                        <NeoBrutalistButton
                                                            text="تحلیل عملکرد"
                                                            color="purple-400"
                                                            textColor="white"
                                                            onClick={() => setPerformanceCurrentView('analytics')}
                                                        />
                                                        <NeoBrutalistButton
                                                            text="دانلود گزارش"
                                                            color="orange-400"
                                                            textColor="black"
                                                            onClick={() => alert('در حال آماده‌سازی گزارش...')}
                                                        />
                                                    </div>
                                                </NeoBrutalistCard>

                                                {/* Add extra margin at bottom to ensure full scroll */}
                                                <div style={{ height: '50px', minHeight: '50px' }}></div>
                                            </div>
                                        )}

                                        {/* Customers Content with proper scrolling */}
                                        {performanceCurrentView === 'customers' && (
                                            <div className="customers-content" style={{ minHeight: '0', height: 'auto' }}>
                                                {/* Search and Filter Header */}
                                                <div className="customers-header">
                                                    <h4>مشتریان برتر ({topCustomers.length})</h4>
                                                    <div className="customers-controls">
                                                        <div className="search-wrapper">
                                                            <Search size={16} className="search-icon" />
                                                            <input
                                                                type="text"
                                                                placeholder="جستجو در مشتریان..."
                                                                value={customerSearchTerm}
                                                                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                                                className="customer-search-input"
                                                            />
                                                        </div>
                                                        <select
                                                            value={customerSortBy}
                                                            onChange={(e) => setCustomerSortBy(e.target.value)}
                                                            className="customer-sort-select"
                                                        >
                                                            <option value="total_spent">مبلغ خرید</option>
                                                            <option value="total_orders">تعداد سفارش</option>
                                                            <option value="last_order_date">آخرین سفارش</option>
                                                            <option value="name">نام</option>
                                                        </select>
                                                        <button
                                                            onClick={() => setCustomerSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                                            className="sort-order-btn"
                                                        >
                                                            {customerSortOrder === 'desc' ? <SortDesc size={16} /> : <SortAsc size={16} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Customers Grid */}
                                                <div className="customers-grid" style={{ minHeight: '0' }}>
                                                    {topCustomers.map(customer => (
                                                        <NeoBrutalistCard
                                                            key={customer.id}
                                                            className="customer-card"
                                                            onClick={() => handleCustomerClick(customer)}
                                                            style={{ minHeight: '0', height: 'auto' }}
                                                        >
                                                            <div className="customer-content">
                                                                <div className="customer-info">
                                                                    <div className="customer-avatar">
                                                                        <User size={24} />
                                                                    </div>
                                                                    <div className="customer-details">
                                                                        <h5>{customer.name}</h5>
                                                                        <div className="customer-contact">
                                                                            <Mail size={14} />
                                                                            <span>{customer.email}</span>
                                                                        </div>
                                                                        <div className="customer-contact">
                                                                            <Phone size={14} />
                                                                            <span>{customer.phone}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="customer-stats">
                                                                    <div className="customer-stat">
                                                                        <span className="stat-number">{customer.total_spent.toLocaleString('fa-IR')}</span>
                                                                        <span className="stat-label">تومان</span>
                                                                    </div>
                                                                    <div className="customer-stat">
                                                                        <span className="stat-number">{customer.total_orders}</span>
                                                                        <span className="stat-label">سفارش</span>
                                                                    </div>
                                                                    <div className="customer-stat">
                                                                        <span className="stat-number">{customer.last_order_date ? new Date(customer.last_order_date).toLocaleDateString('fa-IR') : 'ندارد'}</span>
                                                                        <span className="stat-label">آخرین سفارش</span>
                                                                    </div>
                                                                </div>
                                                                <div className={`customer-status ${customer.status}`}>
                                                                    {customer.status === 'active' ? 'فعال' : 'غیرفعال'}
                                                                </div>
                                                            </div>
                                                        </NeoBrutalistCard>
                                                    ))}
                                                </div>

                                                {topCustomers.length === 0 && (
                                                    <div className="empty-state">
                                                        <Users size={48} />
                                                        <h3>مشتری‌ای یافت نشد</h3>
                                                        <p>هیچ مشتری‌ای با این معیارها یافت نشد</p>
                                                    </div>
                                                )}

                                                {/* Bottom spacer for scrolling */}
                                                <div style={{ height: '50px', minHeight: '50px' }}></div>
                                            </div>
                                        )}

                                        {/* Similar fixes for Orders Content */}
                                        {performanceCurrentView === 'orders' && (
                                            <div className="orders-content" style={{ minHeight: '0', height: 'auto' }}>
                                                <h4>سفارشات اخیر ({recentOrders.length})</h4>
                                                <div className="orders-grid" style={{ minHeight: '0' }}>
                                                    {recentOrders.map(order => (
                                                        <NeoBrutalistCard
                                                            key={order.id}
                                                            className="order-card"
                                                            onClick={() => handleOrderClick(order)}
                                                            style={{ minHeight: '0', height: 'auto' }}
                                                        >
                                                            <div className="order-content">
                                                                <div className="order-header">
                                                                    <h5>{order.id}</h5>
                                                                    <div className={`order-status ${order.status}`}>
                                                                        {order.status === 'completed' ? 'تکمیل شده' : 'در انتظار'}
                                                                    </div>
                                                                </div>
                                                                <div className="order-details">
                                                                    <span>مشتری: {order.customer_name}</span>
                                                                    <span>تاریخ: {new Date(order.date).toLocaleDateString('fa-IR')}</span>
                                                                    <span>{order.items_count} قلم</span>
                                                                </div>
                                                                <div className="order-amounts">
                                                                    <div className="order-amount">
                                                                        <span className="amount">{order.amount.toLocaleString('fa-IR')}</span>
                                                                        <span className="label">تومان</span>
                                                                    </div>
                                                                    <div className="commission-amount">
                                                                        <span>کمیسیون: {order.commission.toLocaleString('fa-IR')} تومان</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </NeoBrutalistCard>
                                                    ))}
                                                </div>

                                                {recentOrders.length === 0 && (
                                                    <div className="empty-state">
                                                        <Package size={48} />
                                                        <h3>سفارشی یافت نشد</h3>
                                                        <p>هیچ سفارشی برای این نماینده ثبت نشده است</p>
                                                    </div>
                                                )}

                                                <div style={{ height: '50px', minHeight: '50px' }}></div>
                                            </div>
                                        )}

                                        {/* Analytics Content with fixed scrolling */}
                                        {performanceCurrentView === 'analytics' && (
                                            <div className="analytics-content" style={{ minHeight: '0', height: 'auto' }}>
                                                <h4>تحلیل عملکرد ماهانه</h4>

                                                {monthlyStats.length > 0 && (
                                                    <NeoBrutalistCard className="monthly-chart-card">
                                                        <h5>نمودار فروش و کمیسیون ماهانه</h5>
                                                        <div className="monthly-stats-list">
                                                            {monthlyStats.map((month, index) => (
                                                                <div key={index} className="monthly-stat-item">
                                                                    <div className="month-name">{month.month}</div>
                                                                    <div className="month-orders">
                                                                        <Package size={16} />
                                                                        <span>{month.orders} سفارش</span>
                                                                    </div>
                                                                    <div className="month-sales">
                                                                        <DollarSign size={16} />
                                                                        <span>{(month.sales / 1000000).toFixed(1)}M تومان</span>
                                                                    </div>
                                                                    <div className="month-commission">
                                                                        <TrendingUp size={16} />
                                                                        <span>{month.commission.toLocaleString('fa-IR')} تومان</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </NeoBrutalistCard>
                                                )}

                                                {dealerPerformanceData && (
                                                    <div className="analytics-metrics-grid">
                                                        <NeoBrutalistCard className="metric-card">
                                                            <Activity size={32} />
                                                            <div className="metric-value">{dealerPerformanceData.overview.avg_order_value.toLocaleString('fa-IR')}</div>
                                                            <div className="metric-label">متوسط ارزش سفارش (تومان)</div>
                                                        </NeoBrutalistCard>

                                                        <NeoBrutalistCard className="metric-card">
                                                            <Star size={32} />
                                                            <div className="metric-value">{dealerPerformanceData.dealer.dealer_commission_rate}%</div>
                                                            <div className="metric-label">نرخ کمیسیون فعلی</div>
                                                        </NeoBrutalistCard>

                                                        <NeoBrutalistCard className="metric-card">
                                                            <Clock size={32} />
                                                            <div className="metric-value">{Math.floor((new Date() - new Date(dealerPerformanceData.dealer.date_joined)) / (1000 * 60 * 60 * 24))}</div>
                                                            <div className="metric-label">روز همکاری</div>
                                                        </NeoBrutalistCard>
                                                    </div>
                                                )}

                                                <div style={{ height: '50px', minHeight: '50px' }}></div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </NeoBrutalistModal>

            {/* Customer Orders Modal */}
            {customerOrdersOpen && (
                <div className="modal-overlay">
                    <div className="customer-orders-modal">
                        <div className="modal-header">
                            <h3>سفارشات {selectedCustomer?.name}</h3>
                            <button
                                onClick={() => setCustomerOrdersOpen(false)}
                                className="close-btn"
                            >
                                ×
                            </button>
                        </div>

                        <div className="customer-summary">
                            <div className="summary-stats">
                                <div className="summary-stat">
                                    <strong>کل سفارشات:</strong>
                                    <span>{selectedCustomer?.total_orders}</span>
                                </div>
                                <div className="summary-stat">
                                    <strong>مجموع خرید:</strong>
                                    <span>{selectedCustomer?.total_spent.toLocaleString('fa-IR')} تومان</span>
                                </div>
                                <div className="summary-stat">
                                    <strong>آخرین سفارش:</strong>
                                    <span>{selectedCustomer?.last_order_date ? new Date(selectedCustomer.last_order_date).toLocaleDateString('fa-IR') : 'ندارد'}</span>
                                </div>
                                <div className="summary-stat">
                                    <strong>وضعیت:</strong>
                                    <span className={selectedCustomer?.status}>{selectedCustomer?.status === 'active' ? 'فعال' : 'غیرفعال'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="customer-orders-list">
                            {customerOrders.length > 0 ? customerOrders.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => handleOrderClick(order)}
                                    className="customer-order-item"
                                >
                                    <div className="order-info">
                                        <div className="order-id">{order.id}</div>
                                        <div className="order-date">{new Date(order.date).toLocaleDateString('fa-IR')} - {order.items?.length || 0} قلم</div>
                                    </div>
                                    <div className="order-amount">
                                        <div className="amount">{order.total_amount.toLocaleString('fa-IR')} تومان</div>
                                        <div className={`status ${order.status}`}>
                                            {order.status === 'completed' ? 'تکمیل شده' : 'در انتظار'}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="empty-state">
                                    <Package size={48} />
                                    <h3>هیچ سفارشی یافت نشد</h3>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Order Details Modal */}
            {orderDetailsOpen && (
                <div className="modal-overlay">
                    <div className="order-details-modal">
                        <div className="modal-header">
                            <h3>جزئیات سفارش {selectedOrder?.id}</h3>
                            <button
                                onClick={() => setOrderDetailsOpen(false)}
                                className="close-btn"
                            >
                                ×
                            </button>
                        </div>

                        {orderDetails ? (
                            <div className="order-details-content">
                                <div className="order-info-grid">
                                    <div className="info-item">
                                        <strong>تاریخ سفارش:</strong>
                                        <span>{new Date(orderDetails.date).toLocaleDateString('fa-IR')}</span>
                                    </div>
                                    <div className="info-item">
                                        <strong>وضعیت:</strong>
                                        <span className={orderDetails.status}>
                                            {orderDetails.status === 'completed' ? 'تکمیل شده' : 'در انتظار'}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <strong>مبلغ کل:</strong>
                                        <span>{orderDetails.total_amount.toLocaleString('fa-IR')} تومان</span>
                                    </div>
                                    <div className="info-item">
                                        <strong>تعداد آیتم:</strong>
                                        <span>{orderDetails.items?.length || 0} قلم</span>
                                    </div>
                                </div>

                                {orderDetails.items && orderDetails.items.length > 0 && (
                                    <div className="order-items">
                                        <h4>آیتم‌های سفارش:</h4>
                                        <div className="items-list">
                                            {orderDetails.items.map((item, index) => (
                                                <div key={index} className="order-item">
                                                    <div className="item-info">
                                                        <div className="item-name">{item.product_name}</div>
                                                        <div className="item-quantity">تعداد: {item.quantity}</div>
                                                    </div>
                                                    <div className="item-price">
                                                        {item.total_price.toLocaleString('fa-IR')} تومان
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {orderDetails.commission && (
                                    <div className="order-commission">
                                        <h4>کمیسیون:</h4>
                                        <div className="commission-details">
                                            <div>نرخ: {orderDetails.commission.rate}%</div>
                                            <div>مبلغ: {orderDetails.commission.amount.toLocaleString('fa-IR')} تومان</div>
                                            <div className={`payment-status ${orderDetails.commission.is_paid ? 'paid' : 'unpaid'}`}>
                                                {orderDetails.commission.is_paid ? 'پرداخت شده' : 'پرداخت نشده'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <p>در حال بارگیری جزئیات سفارش...</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDealersPage;