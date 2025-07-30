// frontend/src/pages/admin/AdminDealersPage.js - Complete Dealer Management
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Search, Filter, Eye, Edit, UserCheck, UserX, Mail, Phone, Building,
    Star, TrendingUp, AlertCircle, CheckCircle, XCircle, Plus, Download,
    Calendar, CreditCard, Package, MoreVertical, UserPlus, DollarSign,
    Shield, Crown, Settings, PieChart, BarChart3, Handshake
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
    const [dealerPerformance, setDealerPerformance] = useState(null);

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
            console.error('❌ Error fetching dealers:', err);
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
            console.error('❌ Error fetching commissions:', err);
        }
    }, []);

    const fetchDealerStats = useCallback(async () => {
        try {
            const response = await API.get('/admin/dashboard/stats/dealers/');
            setDealerStats(response.data);
        } catch (err) {
            console.error('❌ Error fetching dealer stats:', err);
        }
    }, []);

    useEffect(() => {
        fetchDealers();
        fetchCommissions();
        fetchDealerStats();
    }, [fetchDealers, fetchCommissions, fetchDealerStats]);

    useEffect(() => {
        filterAndSortDealers();
    }, [dealers, searchTerm, statusFilter, sortBy]);

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

    const handleViewPerformance = async (dealer) => {
        setSelectedDealer(dealer);
        setIsPerformanceModalOpen(true);
        try {
            const response = await API.get(`/admin/dealers/${dealer.id}/performance/`);
            setDealerPerformance(response.data);
        } catch (err) {
            console.error('Error fetching dealer performance:', err);
            setError('خطا در بارگیری آمار عملکرد');
        }
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
                                        // Navigate to detailed sales report
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
                                        // Navigate to commission analysis
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
                                        // Export to Excel
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

            {/* Dealer Performance Modal */}
            <NeoBrutalistModal
                isOpen={isPerformanceModalOpen}
                onClose={() => setIsPerformanceModalOpen(false)}
                title={selectedDealer ? `آمار عملکرد: ${selectedDealer.name}` : ''}
                size="large"
            >
                {dealerPerformance ? (
                    <div className="performance-modal">
                        <NeoBrutalistCard className="performance-summary">
                            <h4>خلاصه عملکرد</h4>
                            <div className="performance-stats-grid">
                                <div className="performance-stat">
                                    <span className="stat-number">{dealerPerformance.performance.total_orders}</span>
                                    <span className="stat-label">کل سفارشات تخصیص یافته</span>
                                </div>
                                <div className="performance-stat">
                                    <span className="stat-number">{dealerPerformance.performance.completed_orders}</span>
                                    <span className="stat-label">سفارشات تکمیل شده</span>
                                </div>
                                <div className="performance-stat">
                                    <span className="stat-number">{dealerPerformance.performance.conversion_rate}%</span>
                                    <span className="stat-label">نرخ تبدیل</span>
                                </div>
                                <div className="performance-stat">
                                    <span className="stat-number">{(dealerPerformance.performance.total_sales / 1000).toFixed(0)}K</span>
                                    <span className="stat-label">فروش کل (هزار تومان)</span>
                                </div>
                            </div>
                        </NeoBrutalistCard>

                        <NeoBrutalistCard className="commission-details">
                            <h4>جزئیات کمیسیون</h4>
                            <div className="commission-breakdown">
                                <div className="commission-item">
                                    <span>کل کمیسیون کسب شده:</span>
                                    <span className="amount">{dealerPerformance.performance.total_commission_earned.toLocaleString('fa-IR')} تومان</span>
                                </div>
                                <div className="commission-item">
                                    <span>کمیسیون پرداخت شده:</span>
                                    <span className="amount paid">{dealerPerformance.performance.paid_commission.toLocaleString('fa-IR')} تومان</span>
                                </div>
                                <div className="commission-item">
                                    <span>کمیسیون در انتظار پرداخت:</span>
                                    <span className="amount pending">{dealerPerformance.performance.pending_commission.toLocaleString('fa-IR')} تومان</span>
                                </div>
                            </div>
                        </NeoBrutalistCard>

                        <NeoBrutalistCard className="performance-actions">
                            <h4>عملیات</h4>
                            <div className="action-buttons">
                                <NeoBrutalistButton
                                    text="مشاهده سفارشات تخصیص یافته"
                                    color="blue-400"
                                    textColor="white"
                                    onClick={() => {
                                        navigate(`/admin/orders?dealer=${selectedDealer.name}`);
                                    }}
                                />
                                <NeoBrutalistButton
                                    text="پرداخت کمیسیون‌های معوق"
                                    color="green-400"
                                    textColor="black"
                                    onClick={() => {
                                        // Handle commission payment
                                        const unpaidCommissions = commissions.filter(
                                            c => c.dealer_name === selectedDealer.name && !c.is_paid
                                        );
                                        if (unpaidCommissions.length > 0) {
                                            handlePayCommissions(unpaidCommissions.map(c => c.id));
                                        }
                                    }}
                                />
                                <NeoBrutalistButton
                                    text="ویرایش نرخ کمیسیون"
                                    color="yellow-400"
                                    textColor="black"
                                    onClick={() => {
                                        const newRate = prompt('نرخ کمیسیون جدید (درصد):', selectedDealer.dealer_commission_rate);
                                        if (newRate && !isNaN(newRate)) {
                                            handleUpdateCommission(selectedDealer.id, parseFloat(newRate));
                                        }
                                    }}
                                />
                            </div>
                        </NeoBrutalistCard>
                    </div>
                ) : (
                    <div className="modal-loading">
                        <div className="loading-spinner"></div>
                        <p>در حال بارگیری آمار عملکرد...</p>
                    </div>
                )}
            </NeoBrutalistModal>


        </div>
    );
};

export default AdminDealersPage;