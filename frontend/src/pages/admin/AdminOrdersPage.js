// frontend/src/pages/AdminOrdersPage.js - Enhanced with NeoBrutalist components
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Package, Search, Filter, Eye, Edit, Clock, CheckCircle, XCircle, AlertCircle,
    Star, TrendingUp, Users, Phone, Mail, Building, Download, FileText,
    Calendar, CreditCard, MoreVertical, Plus
} from 'lucide-react';
import API from '../../component/api';
import AdminOrderDetailPage from './component/AdminOrderDetailPage';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistDropdown from '../../component/NeoBrutalist/NeoBrutalistDropdown';
import '../../styles/Admin/AdminOrders.css'

const AdminOrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [filteredOrders, setFilteredOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Filter states
    const [statusFilter, setStatusFilter] = useState('all');
    const [customerFilter, setCustomerFilter] = useState('');
    const [dealerFilter, setDealerFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
    const [sortBy, setSortBy] = useState('newest');

    // Data for filters
    const [customers, setCustomers] = useState([]);
    const [dealers, setDealers] = useState([]);
    const [orderStats, setOrderStats] = useState({});

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Filter options arrays
    const statusOptions = [
        { value: 'all', label: 'همه وضعیت‌ها' },
        { value: 'pending_pricing', label: 'نیاز به قیمت‌گذاری' },
        { value: 'waiting_customer_approval', label: 'منتظر تأیید مشتری' },
        { value: 'confirmed', label: 'تأیید شده' },
        { value: 'completed', label: 'تکمیل شده' },
        { value: 'rejected', label: 'رد شده' }
    ];

    const dealerOptions = [
        { value: 'all', label: 'همه نمایندگان' },
        { value: 'unassigned', label: 'بدون نماینده' },
        ...dealers.map(dealer => ({
            value: dealer.name,
            label: dealer.name
        }))
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
        { value: 'customer', label: 'نام مشتری' },
        { value: 'amount', label: 'مبلغ سفارش' },
        { value: 'status', label: 'وضعیت' }
    ];

    useEffect(() => {
        // Set initial filters from URL parameters
        const status = searchParams.get('status');
        const customer = searchParams.get('customer');
        if (status) setStatusFilter(status);
        if (customer) setCustomerFilter(customer);

        fetchOrders();
        fetchFilterData();
    }, []);

    useEffect(() => {
        filterAndSortOrders();
    }, [orders, statusFilter, customerFilter, dealerFilter, dateFilter, sortBy]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/orders/');
            setOrders(response.data);
            calculateStats(response.data);
            setError('');
        } catch (err) {
            console.error('❌ Error fetching orders:', err);
            if (err.response?.status === 401) {
                setError('نشست شما منقضی شده است. در حال انتقال به صفحه ورود...');
                setTimeout(() => handleLogout(), 2000);
            } else {
                setError('خطا در بارگیری سفارشات');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchFilterData = async () => {
        try {
            // Fetch unique customers and dealers for filter dropdowns
            const [customersRes, dealersRes] = await Promise.all([
                API.get('/admin/customers/'),
                API.get('/admin/dealers/')
            ]);

            setCustomers(customersRes.data);
            setDealers(dealersRes.data);
        } catch (err) {
            console.error('❌ Error fetching filter data:', err);
        }
    };

    const calculateStats = (ordersList) => {
        const stats = {
            total: ordersList.length,
            pending_pricing: ordersList.filter(o => o.status === 'pending_pricing').length,
            waiting_customer_approval: ordersList.filter(o => o.status === 'waiting_customer_approval').length,
            confirmed: ordersList.filter(o => o.status === 'confirmed').length,
            completed: ordersList.filter(o => o.status === 'completed').length,
            rejected: ordersList.filter(o => o.status === 'rejected').length,
            with_dealer: ordersList.filter(o => o.assigned_dealer_name).length,
            without_dealer: ordersList.filter(o => !o.assigned_dealer_name).length,
        };
        setOrderStats(stats);
    };

    const filterAndSortOrders = () => {
        let filtered = [...orders];

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(order => order.status === statusFilter);
        }

        // Apply customer filter (search in customer name)
        if (customerFilter.trim()) {
            filtered = filtered.filter(order =>
                order.customer_name.toLowerCase().includes(customerFilter.toLowerCase()) ||
                order.customer_email?.toLowerCase().includes(customerFilter.toLowerCase()) ||
                order.customer_phone?.includes(customerFilter)
            );
        }

        // Apply dealer filter
        if (dealerFilter !== 'all') {
            if (dealerFilter === 'unassigned') {
                filtered = filtered.filter(order => !order.assigned_dealer_name);
            } else {
                filtered = filtered.filter(order =>
                    order.assigned_dealer_name === dealerFilter
                );
            }
        }

        // Apply date filter
        if (dateFilter !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filtered = filtered.filter(order => {
                const orderDate = new Date(order.created_at);

                switch (dateFilter) {
                    case 'today':
                        return orderDate >= today;
                    case 'week':
                        const weekAgo = new Date(today);
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return orderDate >= weekAgo;
                    case 'month':
                        const monthAgo = new Date(today);
                        monthAgo.setMonth(monthAgo.getMonth() - 1);
                        return orderDate >= monthAgo;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.created_at) - new Date(a.created_at);
                case 'oldest':
                    return new Date(a.created_at) - new Date(b.created_at);
                case 'customer':
                    return a.customer_name.localeCompare(b.customer_name, 'fa');
                case 'amount':
                    return (b.quoted_total || 0) - (a.quoted_total || 0);
                case 'status':
                    return a.status.localeCompare(b.status);
                default:
                    return 0;
            }
        });

        setFilteredOrders(filtered);
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending_pricing': return 'yellow-400';
            case 'waiting_customer_approval': return 'blue-400';
            case 'confirmed': return 'green-400';
            case 'completed': return 'green-600';
            case 'rejected': return 'red-400';
            case 'cancelled': return 'gray-400';
            default: return 'gray-400';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending_pricing': return Clock;
            case 'waiting_customer_approval': return AlertCircle;
            case 'confirmed': return CheckCircle;
            case 'completed': return CheckCircle;
            case 'rejected': return XCircle;
            case 'cancelled': return XCircle;
            default: return Package;
        }
    };

    const formatStatus = (status) => {
        const statusMap = {
            'pending_pricing': 'نیاز به قیمت‌گذاری',
            'waiting_customer_approval': 'منتظر تأیید مشتری',
            'confirmed': 'تأیید شده',
            'completed': 'تکمیل شده',
            'rejected': 'رد شده',
            'cancelled': 'لغو شده'
        };
        return statusMap[status] || status;
    };

    const clearAllFilters = () => {
        setStatusFilter('all');
        setCustomerFilter('');
        setDealerFilter('all');
        setDateFilter('all');
        setSortBy('newest');
    };

    if (loading) {
        return (
            <div className="admin-orders-page">
                <div className="loading-container">
                    <div className="loading-spinner"></div>
                    <p>در حال بارگیری سفارشات...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-orders-page" dir="rtl">
            {/* Header */}
            <div className="page-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="page-title">
                            <Package className="title-icon" />
                            مدیریت سفارشات
                        </h1>
                        <p className="page-subtitle">
                            {filteredOrders.length} سفارش از مجموع {orders.length} سفارش
                        </p>
                    </div>
                    <div className="header-actions">
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
                    <NeoBrutalistCard className="stat-card total" onClick={() => setStatusFilter('all')}>
                        <div className="stat-content">
                            <Package className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{orderStats.total || 0}</span>
                                <span className="stat-label">کل سفارشات</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card pending" onClick={() => setStatusFilter('pending_pricing')}>
                        <div className="stat-content">
                            <Clock className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{orderStats.pending_pricing || 0}</span>
                                <span className="stat-label">نیاز به قیمت‌گذاری</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card waiting" onClick={() => setStatusFilter('waiting_customer_approval')}>
                        <div className="stat-content">
                            <AlertCircle className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{orderStats.waiting_customer_approval || 0}</span>
                                <span className="stat-label">منتظر تأیید</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card completed" onClick={() => setStatusFilter('completed')}>
                        <div className="stat-content">
                            <CheckCircle className="stat-icon" />
                            <div className="stat-info">
                                <span className="stat-number">{orderStats.completed || 0}</span>
                                <span className="stat-label">تکمیل شده</span>
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
                        onClick={clearAllFilters}
                    />
                </div>

                <div className="filters-grid">
                    <div className="search-wrapper">
                        <Search className="search-icon" />
                        <NeoBrutalistInput
                            placeholder="جستجو در نام، ایمیل یا شماره تلفن مشتری..."
                            value={customerFilter}
                            onChange={(e) => setCustomerFilter(e.target.value)}
                            className="search-input"
                        />
                    </div>

                    <NeoBrutalistDropdown
                        label="وضعیت سفارش"
                        options={statusOptions}
                        value={statusFilter}
                        onChange={(value) => setStatusFilter(value)}
                    />

                    <NeoBrutalistDropdown
                        label="نماینده فروش"
                        options={dealerOptions}
                        value={dealerFilter}
                        onChange={(value) => setDealerFilter(value)}
                    />

                    <NeoBrutalistDropdown
                        label="تاریخ ثبت"
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

                {/* Active Filters Display */}
                {(statusFilter !== 'all' || customerFilter || dealerFilter !== 'all' || dateFilter !== 'all') && (
                    <div className="active-filters">
                        {statusFilter !== 'all' && (
                            <span className="filter-tag">
                                وضعیت: {formatStatus(statusFilter)}
                                <button onClick={() => setStatusFilter('all')}>×</button>
                            </span>
                        )}
                        {customerFilter && (
                            <span className="filter-tag">
                                مشتری: {customerFilter}
                                <button onClick={() => setCustomerFilter('')}>×</button>
                            </span>
                        )}
                        {dealerFilter !== 'all' && (
                            <span className="filter-tag">
                                نماینده: {dealerFilter === 'unassigned' ? 'بدون نماینده' : dealerFilter}
                                <button onClick={() => setDealerFilter('all')}>×</button>
                            </span>
                        )}
                        {dateFilter !== 'all' && (
                            <span className="filter-tag">
                                تاریخ: {dateFilter === 'today' ? 'امروز' : dateFilter === 'week' ? 'هفته گذشته' : 'ماه گذشته'}
                                <button onClick={() => setDateFilter('all')}>×</button>
                            </span>
                        )}
                    </div>
                )}
            </NeoBrutalistCard>

            {/* Orders Grid */}
            <div className="orders-grid">
                {filteredOrders.map(order => {
                    const StatusIcon = getStatusIcon(order.status);
                    return (
                        <NeoBrutalistCard
                            key={order.id}
                            className={`order-card ${order.status}`}
                        >
                            <div className="card-header">
                                <div className="order-identity">
                                    <h3 className="order-id">سفارش #{order.id}</h3>
                                    <span className="order-date">
                                        <Calendar size={14} />
                                        {new Date(order.created_at).toLocaleDateString('fa-IR')}
                                    </span>
                                </div>

                                <div className="order-tags">
                                    <span className={`tag status-tag ${order.status}`}>
                                        <StatusIcon size={12} />
                                        {formatStatus(order.status)}
                                    </span>
                                </div>
                            </div>

                            <div className="order-details">
                                <div className="detail-row">
                                    <Users size={16} className="detail-icon" />
                                    <span>{order.customer_name}</span>
                                </div>

                                {order.customer_phone && (
                                    <div className="detail-row">
                                        <Phone size={16} className="detail-icon" />
                                        <span>{order.customer_phone}</span>
                                    </div>
                                )}

                                {order.assigned_dealer_name && (
                                    <div className="detail-row">
                                        <Star size={16} className="detail-icon" />
                                        <span>نماینده: {order.assigned_dealer_name}</span>
                                    </div>
                                )}

                                <div className="detail-row">
                                    <span className="detail-label">تعداد اقلام:</span>
                                    <span>{order.items?.length || 0}</span>
                                </div>

                                {order.quoted_total && (
                                    <div className="detail-row">
                                        <CreditCard size={16} className="detail-icon" />
                                        <span className="total-amount">
                                            {order.quoted_total.toLocaleString('fa-IR')} ریال
                                        </span>
                                    </div>
                                )}
                            </div>

                            {order.customer_comment && (
                                <div className="customer-comment">
                                    <p>💬 {order.customer_comment.substring(0, 80)}...</p>
                                </div>
                            )}

                            <div className="card-actions">
                                <NeoBrutalistButton
                                    text="مشاهده جزئیات"
                                    color="blue-400"
                                    textColor="white"
                                    onClick={() => setSelectedOrder(order)}
                                />

                                {order.status === 'pending_pricing' && (
                                    <NeoBrutalistButton
                                        text="قیمت‌گذاری"
                                        color="yellow-400"
                                        textColor="black"
                                        onClick={() => setSelectedOrder(order)}
                                    />
                                )}

                                {order.status === 'confirmed' && (
                                    <NeoBrutalistButton
                                        text="تکمیل سفارش"
                                        color="green-400"
                                        textColor="black"
                                        onClick={() => setSelectedOrder(order)}
                                    />
                                )}
                            </div>
                        </NeoBrutalistCard>
                    );
                })}
            </div>

            {/* Empty State */}
            {filteredOrders.length === 0 && !loading && (
                <NeoBrutalistCard className="empty-state-card">
                    <div className="empty-content">
                        <Package size={48} className="empty-icon" />
                        <h3>سفارشی یافت نشد</h3>
                        <p>
                            {orders.length === 0
                                ? 'هنوز هیچ سفارشی ثبت نشده است.'
                                : 'بر اساس فیلترهای انتخاب شده، سفارشی یافت نشد.'
                            }
                        </p>
                        {orders.length > 0 && (
                            <NeoBrutalistButton
                                text="پاک کردن فیلترها"
                                color="blue-400"
                                textColor="white"
                                onClick={clearAllFilters}
                            />
                        )}
                    </div>
                </NeoBrutalistCard>
            )}

            {/* Quick Actions */}
            <NeoBrutalistCard className="quick-actions-card">
                <div className="quick-actions-header">
                    <h3>عملیات سریع</h3>
                </div>
                <div className="quick-actions-grid">
                    <NeoBrutalistButton
                        text={`⏱️ در انتظار قیمت‌گذاری (${orderStats.pending_pricing || 0})`}
                        color="yellow-400"
                        textColor="black"
                        onClick={() => setStatusFilter('pending_pricing')}
                    />
                    <NeoBrutalistButton
                        text={`👥 بدون نماینده (${orderStats.without_dealer || 0})`}
                        color="orange-400"
                        textColor="black"
                        onClick={() => setDealerFilter('unassigned')}
                    />
                    <NeoBrutalistButton
                        text="📊 گزارش سفارشات"
                        color="purple-400"
                        textColor="white"
                        onClick={() => navigate('/admin/reports/orders')}
                    />
                    <NeoBrutalistButton
                        text="📤 خروجی Excel"
                        color="green-400"
                        textColor="black"
                        onClick={() => {
                            // Export filtered orders to Excel
                            window.open(`/api/admin/orders/export/?${new URLSearchParams({
                                status: statusFilter,
                                customer: customerFilter,
                                dealer: dealerFilter,
                                date: dateFilter
                            })}`, '_blank');
                        }}
                    />
                </div>
            </NeoBrutalistCard>

            {/* Order Detail Modal */}
            <NeoBrutalistModal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={selectedOrder ? `ویرایش سفارش #${selectedOrder.id}` : ""}
                size="large"
            >
                {selectedOrder && (
                    <AdminOrderDetailPage
                        orderId={selectedOrder.id}
                        onOrderUpdated={() => {
                            fetchOrders();
                            setSelectedOrder(null);
                        }}
                    />
                )}
            </NeoBrutalistModal>
        </div>
    );
};

export default AdminOrdersPage;