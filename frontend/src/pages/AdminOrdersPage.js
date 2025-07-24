// frontend/src/pages/AdminOrdersPage.js - Enhanced with customer and status filtering
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../component/api';
import AdminOrderDetailPage from '../component/AdminOrderDetailPage';
import NeoBrutalistButton from '../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistInput from '../component/NeoBrutalist/NeoBrutalistInput';
import '../styles/Admin/AdminOrders.css'

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
            console.log('📋 Admin orders fetched:', response.data);
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
                <div className="loading-state">
                    <h1>در حال بارگیری سفارشات...</h1>
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
                        <h1 className="page-title">📋 مدیریت سفارشات</h1>
                        <p className="page-subtitle">
                            {filteredOrders.length} سفارش از مجموع {orders.length} سفارش
                        </p>
                    </div>
                    <div className="header-actions">
                        <NeoBrutalistButton
                            text="داشبورد اصلی"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/admin')}
                            className="dashboard-btn"
                        />
                        <NeoBrutalistButton
                            text="خروج"
                            color="red-400"
                            textColor="white"
                            onClick={handleLogout}
                            className="logout-btn"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <span>⚠️ {error}</span>
                </div>
            )}

            {/* Statistics Cards */}
            <div className="stats-section">
                <div className="stats-grid">
                    <NeoBrutalistCard className="stat-card" onClick={() => setStatusFilter('all')}>
                        <div className="stat-content">
                            <span className="stat-number">{orderStats.total || 0}</span>
                            <span className="stat-label">کل سفارشات</span>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card pending" onClick={() => setStatusFilter('pending_pricing')}>
                        <div className="stat-content">
                            <span className="stat-number">{orderStats.pending_pricing || 0}</span>
                            <span className="stat-label">نیاز به قیمت‌گذاری</span>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card waiting" onClick={() => setStatusFilter('waiting_customer_approval')}>
                        <div className="stat-content">
                            <span className="stat-number">{orderStats.waiting_customer_approval || 0}</span>
                            <span className="stat-label">منتظر تأیید</span>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card completed" onClick={() => setStatusFilter('completed')}>
                        <div className="stat-content">
                            <span className="stat-number">{orderStats.completed || 0}</span>
                            <span className="stat-label">تکمیل شده</span>
                        </div>
                    </NeoBrutalistCard>
                </div>
            </div>

            {/* Advanced Filters */}
            <div className="filters-section">
                <NeoBrutalistCard className="filters-card">
                    <div className="filters-header">
                        <h3>🔍 فیلترهای پیشرفته</h3>
                        <NeoBrutalistButton
                            text="پاک کردن فیلترها"
                            color="gray-400"
                            textColor="black"
                            onClick={clearAllFilters}
                            className="clear-filters-btn"
                        />
                    </div>

                    <div className="filters-grid">
                        {/* Status Filter */}
                        <div className="filter-group">
                            <label>وضعیت سفارش:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">همه وضعیت‌ها</option>
                                <option value="pending_pricing">نیاز به قیمت‌گذاری</option>
                                <option value="waiting_customer_approval">منتظر تأیید مشتری</option>
                                <option value="confirmed">تأیید شده</option>
                                <option value="completed">تکمیل شده</option>
                                <option value="rejected">رد شده</option>
                            </select>
                        </div>

                        {/* Customer Search */}
                        <div className="filter-group">
                            <label>جستجو در مشتری:</label>
                            <NeoBrutalistInput
                                type="text"
                                placeholder="نام، ایمیل یا شماره تلفن..."
                                value={customerFilter}
                                onChange={(e) => setCustomerFilter(e.target.value)}
                                className="customer-search-input"
                            />
                        </div>

                        {/* Dealer Filter */}
                        <div className="filter-group">
                            <label>نماینده فروش:</label>
                            <select
                                value={dealerFilter}
                                onChange={(e) => setDealerFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">همه نمایندگان</option>
                                <option value="unassigned">بدون نماینده</option>
                                {dealers.map(dealer => (
                                    <option key={dealer.id} value={dealer.name}>
                                        {dealer.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date Filter */}
                        <div className="filter-group">
                            <label>تاریخ ثبت:</label>
                            <select
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">همه تاریخ‌ها</option>
                                <option value="today">امروز</option>
                                <option value="week">هفته گذشته</option>
                                <option value="month">ماه گذشته</option>
                            </select>
                        </div>

                        {/* Sort Options */}
                        <div className="filter-group">
                            <label>مرتب‌سازی:</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="filter-select"
                            >
                                <option value="newest">جدیدترین</option>
                                <option value="oldest">قدیمی‌ترین</option>
                                <option value="customer">نام مشتری</option>
                                <option value="amount">مبلغ سفارش</option>
                                <option value="status">وضعیت</option>
                            </select>
                        </div>
                    </div>

                    {/* Active Filters Display */}
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
                </NeoBrutalistCard>
            </div>

            {/* Orders Grid */}
            <div className="orders-grid">
                {filteredOrders.map(order => (
                    <NeoBrutalistCard
                        key={order.id}
                        className={`order-card ${order.status}`}
                        onClick={() => setSelectedOrder(order)}
                    >
                        <div className="order-header">
                            <div className="order-info">
                                <h3>سفارش #{order.id}</h3>
                                <span className="order-date">
                                    {new Date(order.created_at).toLocaleDateString('fa-IR')}
                                </span>
                            </div>
                            <NeoBrutalistButton
                                text={formatStatus(order.status)}
                                color={getStatusColor(order.status)}
                                textColor="black"
                                className="status-badge"
                            />
                        </div>

                        <div className="order-details">
                            <div className="customer-info">
                                <strong>👤 {order.customer_name}</strong>
                                {order.customer_phone && (
                                    <span className="phone">📞 {order.customer_phone}</span>
                                )}
                            </div>

                            {order.assigned_dealer_name && (
                                <div className="dealer-info">
                                    <span>🤝 نماینده: {order.assigned_dealer_name}</span>
                                </div>
                            )}

                            <div className="order-summary">
                                <span>تعداد اقلام: {order.items?.length || 0}</span>
                                {order.quoted_total && (
                                    <span className="total-amount">
                                        💰 {order.quoted_total.toLocaleString('fa-IR')} ریال
                                    </span>
                                )}
                            </div>

                            {order.customer_comment && (
                                <div className="customer-comment">
                                    <p>💬 {order.customer_comment.substring(0, 80)}...</p>
                                </div>
                            )}
                        </div>

                        <div className="order-actions">
                            <NeoBrutalistButton
                                text="مشاهده جزئیات"
                                color="blue-400"
                                textColor="white"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(order);
                                }}
                                className="view-details-btn"
                            />

                            {order.status === 'pending_pricing' && (
                                <NeoBrutalistButton
                                    text="قیمت‌گذاری"
                                    color="yellow-400"
                                    textColor="black"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrder(order);
                                    }}
                                    className="pricing-btn"
                                />
                            )}

                            {order.status === 'confirmed' && (
                                <NeoBrutalistButton
                                    text="تکمیل سفارش"
                                    color="green-400"
                                    textColor="black"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrder(order);
                                    }}
                                    className="complete-btn"
                                />
                            )}
                        </div>
                    </NeoBrutalistCard>
                ))}
            </div>

            {/* Empty State */}
            {filteredOrders.length === 0 && !loading && (
                <div className="empty-state">
                    <NeoBrutalistCard className="empty-card">
                        <div className="empty-content">
                            <div className="empty-icon">📋</div>
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
                                    className="clear-filters-btn"
                                />
                            )}
                        </div>
                    </NeoBrutalistCard>
                </div>
            )}

            {/* Quick Action Buttons */}
            <div className="quick-actions">
                <NeoBrutalistCard className="quick-actions-card">
                    <h3>عملیات سریع</h3>
                    <div className="quick-actions-grid">
                        <NeoBrutalistButton
                            text={`⏱️ در انتظار قیمت‌گذاری (${orderStats.pending_pricing || 0})`}
                            color="yellow-400"
                            textColor="black"
                            onClick={() => setStatusFilter('pending_pricing')}
                            className="quick-filter-btn"
                        />
                        <NeoBrutalistButton
                            text={`👥 بدون نماینده (${orderStats.without_dealer || 0})`}
                            color="orange-400"
                            textColor="black"
                            onClick={() => setDealerFilter('unassigned')}
                            className="quick-filter-btn"
                        />
                        <NeoBrutalistButton
                            text="📊 گزارش سفارشات"
                            color="purple-400"
                            textColor="white"
                            onClick={() => navigate('/admin/reports/orders')}
                            className="report-btn"
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
                            className="export-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            </div>

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