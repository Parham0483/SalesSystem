// Enhanced DealerDashboard.js - Add commission tracking to order cards
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api';
import { useCategories } from '../../hooks/useCategories';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import DealerOrderDetailPage from '../../component/DealerOrderDetailPage';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import ProfilePage from '../../component/ProfilePage';

import "../../styles/component/DealerComponent/DealerDashboard.css"

const DealerDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const { categories } = useCategories();
    const [activeTab, setActiveTab] = useState('active');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dealerStats, setDealerStats] = useState(null);
    const [recentProducts, setRecentProducts] = useState([]);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    // NEW: Commission data state
    const [commissionData, setCommissionData] = useState({});
    const [loadingCommission, setLoadingCommission] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [ordersPerPage] = useState(12);

    const navigate = useNavigate();

    useEffect(() => {
        const userDataString = localStorage.getItem('userData');
        const user = userDataString ? JSON.parse(userDataString) : null;

        if (!user || (!user.is_dealer && !user.is_staff)) {
            navigate('/login');
            return;
        }

        fetchAssignedOrders();
        fetchDealerStats();
        fetchRecentProducts();
        fetchRecentAnnouncements();
    }, [navigate, refreshKey]);

    // Reset to first page when tab changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    // NEW: Fetch commission data when orders are loaded
    useEffect(() => {
        if (orders.length > 0) {
            fetchCommissionData();
        }
    }, [orders]);

    // Auto-refresh with modal awareness
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeTab === 'active' && !loading && !selectedOrder && !showProfileModal) {
                console.log('Auto-refreshing orders (no modals open)');
                fetchAssignedOrders();
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [activeTab, loading, selectedOrder, showProfileModal]);

    const fetchAssignedOrders = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await API.get('/orders/my-assigned-orders/');
            console.log('📦 Assigned orders response:', response.data);
            setOrders(response.data.orders || []);
        } catch (err) {
            console.error('❌ Error fetching assigned orders:', err);
            if (err.response?.status === 403) {
                setError('دسترسی رد شد. لطفاً مجدداً وارد شوید.');
                setTimeout(() => navigate('/login'), 2000);
            } else if (err.response?.status === 401) {
                setError('جلسه شما منقضی شده است. در حال انتقال...');
                setTimeout(() => navigate('/login'), 2000);
            } else {
                setError('خطا در بارگیری سفارشات تخصیص داده شده');
            }
        } finally {
            setLoading(false);
        }
    };

    // NEW: Fetch commission data for all orders
    const fetchCommissionData = async () => {
        setLoadingCommission(true);
        try {
            const orderIds = orders.map(order => order.id).join(',');
            const response = await API.get(`/orders/dealer-commission-bulk/?order_ids=${orderIds}`);

            // Transform response to object with order_id as key
            const commissionMap = {};
            response.data.forEach(commission => {
                commissionMap[commission.order_id] = commission;
            });
            setCommissionData(commissionMap);
        } catch (err) {
            console.error('Error fetching bulk commission data:', err);
            // Fallback: use existing commission data from orders
            const fallbackCommissionData = {};
            orders.forEach(order => {
                if (order.effective_commission_rate || order.dealer_commission_amount) {
                    fallbackCommissionData[order.id] = {
                        order_id: order.id,
                        default_commission_rate: order.default_commission_rate || 0,
                        effective_commission_rate: order.effective_commission_rate || 0,
                        dealer_commission_amount: order.dealer_commission_amount || 0,
                        commission_paid: order.commission_paid || false,
                        commission_status: order.commission_status || 'pending'
                    };
                }
            });
            setCommissionData(fallbackCommissionData);
        } finally {
            setLoadingCommission(false);
        }
    };

    const fetchDealerStats = async () => {
        try {
            const response = await API.get('/orders/dealer-dashboard-stats/');
            setDealerStats(response.data);
        } catch (err) {
            console.error('Error fetching dealer stats:', err);
        }
    };

    const fetchRecentProducts = async () => {
        try {
            const response = await API.get('/products/new-arrivals/');
            setRecentProducts(response.data.slice(0, 6));
        } catch (err) {
            console.error('Error fetching recent products:', err);
        }
    };

    const fetchRecentAnnouncements = async () => {
        try {
            const response = await API.get('/shipment-announcements/');
            setRecentAnnouncements(response.data.slice(0, 3));
        } catch (err) {
            console.error('Error fetching announcements:', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    // Updated filter function with new statuses
    const getFilteredOrders = () => {
        switch (activeTab) {
            case 'active':
                return orders.filter(order =>
                    ['pending_pricing', 'waiting_customer_approval', 'confirmed', 'payment_uploaded'].includes(order.status)
                );
            case 'completed':
                return orders.filter(order => order.status === 'completed');
            case 'rejected':
                return orders.filter(order =>
                    ['rejected', 'cancelled'].includes(order.status)
                );
            default:
                return orders;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending_pricing': return 'yellow-400';
            case 'waiting_customer_approval': return 'blue-400';
            case 'confirmed': return 'green-400';
            case 'payment_uploaded': return 'purple-400';
            case 'completed': return 'green-600';
            case 'rejected': return 'red-400';
            case 'cancelled': return 'gray-400';
            default: return 'gray-400';
        }
    };

    const formatStatus = (status) => {
        const statusMap = {
            'pending_pricing': 'در انتظار قیمت‌گذاری',
            'waiting_customer_approval': 'در انتظار تأیید مشتری',
            'confirmed': 'تأیید شده - فاکتور صادر شد',
            'payment_uploaded': 'رسید پرداخت آپلود شده',
            'completed': 'تکمیل شده',
            'rejected': 'رد شده',
            'cancelled': 'لغو شده'
        };
        return statusMap[status] || status;
    };

    // FIXED: Better order click handler with validation
    const handleOrderClick = (order) => {
        console.log('🎯 Order clicked:', order);
        console.log('Order ID:', order?.id, 'Type:', typeof order?.id);

        if (!order || !order.id) {
            console.error('❌ Invalid order object:', order);
            alert('خطا: اطلاعات سفارش معتبر نیست');
            return;
        }

        // Ensure the order ID is a valid number/string
        const orderId = order.id;
        if (!orderId || orderId === 'undefined' || orderId === undefined) {
            console.error('❌ Invalid order ID:', orderId);
            alert('خطا: شناسه سفارش معتبر نیست');
            return;
        }

        console.log('✅ Setting selected order with ID:', orderId);
        setSelectedOrder(order);
    };

    const handleOrderUpdated = () => {
        console.log('Order updated, refreshing data...');
        setSelectedOrder(null);
        setRefreshKey(prev => prev + 1);
        fetchAssignedOrders();
        fetchDealerStats();
    };

    const formatPrice = (price) => {
        if (!price || price === 0) return 'تماس بگیرید';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
    };

    // NEW: Get commission status display
    const getCommissionStatusDisplay = (status) => {
        const statusMap = {
            'pending': 'در انتظار',
            'calculated': 'محاسبه شده',
            'paid': 'پرداخت شده',
            'cancelled': 'لغو شده'
        };
        return statusMap[status] || status;
    };

    // NEW: Get commission status color
    const getCommissionStatusColor = (status) => {
        switch (status) {
            case 'pending': return '#f59e0b';
            case 'calculated': return '#3b82f6';
            case 'paid': return '#059669';
            case 'cancelled': return '#dc2626';
            default: return '#6b7280';
        }
    };

    // Get current filtered orders
    const filteredOrders = getFilteredOrders();

    // Pagination calculations
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) {
        return (
            <div className="dealer-dashboard" style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="dashboard-header">
                    <h1>در حال بارگیری...</h1>
                    <div style={{ marginTop: '1rem', color: '#666' }}>
                        📄 در حال دریافت سفارشات تخصیص داده شده...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dealer-dashboard" style={{ padding: '2rem', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
            {/* Header */}
            <div className="dashboard-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                padding: '2rem',
                backgroundColor: '#fff',
                border: '4px solid #000',
                boxShadow: '6px 6px 0px #000'
            }}>
                <div className="user-info">
                    <h1 style={{ margin: 0, fontSize: '2.5rem' }}>پنل نماینده فروش</h1>
                    <span className="welcome-text" style={{ color: '#666' }}>
                        {dealerStats?.dealer && `${dealerStats.dealer.name} - `}
                        مشاهده سفارشات و محصولات
                        <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
                            تعداد سفارشات: {orders.length} | فعال: {orders.filter(o => ['pending_pricing', 'waiting_customer_approval', 'confirmed', 'payment_uploaded'].includes(o.status)).length}
                        </div>
                    </span>
                </div>
                <div className="header-actions">
                    <NeoBrutalistButton
                        text="پروفایل"
                        color="yellow-400"
                        textColor="black"
                        onClick={() => setShowProfileModal(true)}
                        className="profile-btn"
                    />
                    <NeoBrutalistButton
                        text="محموله‌های جدید"
                        color="blue-400"
                        textColor="white"
                        onClick={() => navigate('/product/newarrivals')}
                        className="new-arrivals-btn"
                    />
                    <NeoBrutalistButton
                        text="کاتالوگ"
                        color="purple-400"
                        textColor="white"
                        onClick={() => navigate('/product')}
                        className="products-btn"
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

            {error && (
                <div className="error-banner" style={{
                    backgroundColor: '#fef2f2',
                    border: '4px solid #ef4444',
                    padding: '1rem',
                    marginBottom: '2rem',
                    color: '#dc2626',
                    fontWeight: 'bold'
                }}>
                    <span>⚠️ {error}</span>
                </div>
            )}

            {/* Enhanced Dashboard Tabs */}
            <div className="dashboard-tabs" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <NeoBrutalistButton
                    text={`سفارشات فعال (${orders.filter(o => ['pending_pricing', 'waiting_customer_approval', 'confirmed', 'payment_uploaded'].includes(o.status)).length})`}
                    color={activeTab === 'active' ? 'yellow-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('active')}
                    className="tab-btn"
                />
                <NeoBrutalistButton
                    text={`تکمیل شده (${orders.filter(o => o.status === 'completed').length})`}
                    color={activeTab === 'completed' ? 'green-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('completed')}
                    className="tab-btn"
                />
                <NeoBrutalistButton
                    text={`رد شده (${orders.filter(o => ['rejected', 'cancelled'].includes(o.status)).length})`}
                    color={activeTab === 'rejected' ? 'red-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('rejected')}
                    className="tab-btn"
                />
                <NeoBrutalistButton
                    text="بروزرسانی"
                    color="blue-400"
                    textColor="white"
                    onClick={() => {
                        console.log('Manual refresh triggered');
                        setRefreshKey(prev => prev + 1);
                        fetchAssignedOrders();
                        fetchDealerStats();
                    }}
                    className="refresh-btn"
                    disabled={selectedOrder || showProfileModal}
                />
            </div>

            {/* Orders Grid */}
            <div className="orders-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '2rem',
                marginBottom: '2rem'
            }}>
                {currentOrders.map((order) => {
                    // FIXED: Validate each order before rendering
                    if (!order || !order.id) {
                        console.warn('⚠️ Invalid order in list:', order);
                        return null;
                    }

                    // Get commission data for this order
                    const orderCommission = commissionData[order.id] || {};

                    return (
                        <NeoBrutalistCard
                            key={`${order.id}-${refreshKey}`}
                            className="order-card"
                            onClick={() => handleOrderClick(order)}
                            style={{ cursor: 'pointer' }}
                        >
                            <div className="order-card-header" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '1rem'
                            }}>
                                <h3 style={{ margin: 0 }}>سفارش #{order.id}</h3>
                                <NeoBrutalistButton
                                    text={formatStatus(order.status)}
                                    color={getStatusColor(order.status)}
                                    textColor="black"
                                    className="status-badge"
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        minWidth: 'auto'
                                    }}
                                />
                            </div>

                            <div className="order-card-info" style={{ marginBottom: '1rem' }}>
                                <p><strong>مشتری:</strong> {order.customer_name}</p>
                                <p><strong>تاریخ ایجاد:</strong> {new Date(order.created_at).toLocaleDateString('fa-IR')}</p>

                                {/* ADDED: Invoice Type Display */}
                                <p><strong>نوع فاکتور:</strong>
                                    <span className={`invoice-type-badge ${order.business_invoice_type === 'official' ? 'official' : 'unofficial'}`}>
                                        {order.business_invoice_type === 'official' ? 'رسمی (با مالیات)' : 'شخصی (بدون مالیات)'}
                                    </span>
                                </p>

                                {order.quoted_total > 0 && (
                                    <p><strong>مبلغ:</strong> {order.quoted_total.toLocaleString('fa-IR')} ریال</p>
                                )}
                            </div>

                            {/* NEW: Enhanced Commission Information */}
                            <div className="commission-info-section" style={{
                                backgroundColor: '#f8fafc',
                                border: '2px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '0.75rem',
                                marginBottom: '1rem',
                                fontSize: '0.85rem'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.5rem'
                                }}>
                                    <h4 style={{ margin: 0, color: '#374151', fontSize: '0.9rem' }}>اطلاعات کمیسیون</h4>
                                    <span
                                        style={{
                                            backgroundColor: getCommissionStatusColor(orderCommission.commission_status),
                                            color: 'white',
                                            padding: '2px 6px',
                                            borderRadius: '3px',
                                            fontSize: '0.7rem',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        {getCommissionStatusDisplay(orderCommission.commission_status)}
                                    </span>
                                </div>

                                <div className="commission-details" style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '0.5rem',
                                    fontSize: '0.8rem'
                                }}>
                                    <div>
                                        <span style={{ color: '#6b7280' }}>نرخ پیش‌فرض:</span>
                                        <div style={{ fontWeight: 'bold', color: '#374151' }}>
                                            {orderCommission.default_commission_rate || 0}%
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280' }}>نرخ فعال:</span>
                                        <div style={{ fontWeight: 'bold', color: '#3b82f6' }}>
                                            {orderCommission.effective_commission_rate || 0}%
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280' }}>مبلغ کمیسیون:</span>
                                        <div style={{ fontWeight: 'bold', color: '#059669' }}>
                                            {orderCommission.dealer_commission_amount > 0
                                                ? `${orderCommission.dealer_commission_amount.toLocaleString('fa-IR')} ریال`
                                                : 'محاسبه نشده'}
                                        </div>
                                    </div>
                                    <div>
                                        <span style={{ color: '#6b7280' }}>وضعیت پرداخت:</span>
                                        <div style={{
                                            fontWeight: 'bold',
                                            color: orderCommission.commission_paid ? '#059669' : '#f59e0b'
                                        }}>
                                            {orderCommission.commission_paid ? 'پرداخت شده' : 'پرداخت نشده'}
                                        </div>
                                    </div>
                                </div>

                                {/* Commission calculation preview */}
                                {order.quoted_total > 0 && orderCommission.effective_commission_rate > 0 && (
                                    <div style={{
                                        marginTop: '0.5rem',
                                        padding: '0.4rem',
                                        backgroundColor: '#e0f2fe',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        color: '#0369a1',
                                        textAlign: 'center'
                                    }}>
                                        {order.quoted_total.toLocaleString('fa-IR')} × {orderCommission.effective_commission_rate}% = {(order.quoted_total * orderCommission.effective_commission_rate / 100).toLocaleString('fa-IR')} ریال
                                    </div>
                                )}
                            </div>

                            <div className="order-card-footer">
                                <NeoBrutalistButton
                                    text="مشاهده جزئیات"
                                    color="blue-400"
                                    textColor="white"
                                    className="view-details-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOrderClick(order);
                                    }}
                                />
                            </div>
                        </NeoBrutalistCard>
                    );
                })}
            </div>

            {/* Loading Commission Data Indicator */}
            {loadingCommission && (
                <div style={{
                    textAlign: 'center',
                    padding: '1rem',
                    backgroundColor: '#fef3c7',
                    border: '2px solid #f59e0b',
                    borderRadius: '6px',
                    marginBottom: '2rem',
                    color: '#92400e'
                }}>
                    در حال بارگیری اطلاعات کمیسیون...
                </div>
            )}

            {/* Empty State */}
            {currentOrders.length === 0 && !error && (
                <div className="empty-state" style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '300px'
                }}>
                    <NeoBrutalistCard className="empty-card" style={{
                        textAlign: 'center',
                        maxWidth: '500px',
                        cursor: 'default'
                    }}>
                        <h3>هیچ سفارشی در این بخش وجود ندارد</h3>
                        <p>سفارشات تخصیص داده شده در اینجا نمایش داده می‌شود.</p>
                        <div style={{ marginTop: '1rem' }}>
                            <NeoBrutalistButton
                                text="بروزرسانی"
                                color="blue-400"
                                textColor="white"
                                onClick={fetchAssignedOrders}
                                style={{ marginRight: '1rem' }}
                            />
                            <NeoBrutalistButton
                                text="مشاهده محصولات"
                                color="green-400"
                                textColor="black"
                                onClick={() => navigate('/product')}
                            />
                        </div>
                    </NeoBrutalistCard>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="pagination" style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginTop: '2rem'
                }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <NeoBrutalistButton
                            key={page}
                            text={page.toString()}
                            color={currentPage === page ? 'blue-400' : 'gray-300'}
                            textColor={currentPage === page ? 'white' : 'black'}
                            onClick={() => handlePageChange(page)}
                            style={{
                                minWidth: '40px',
                                padding: '0.5rem'
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Order Detail Modal - FIXED with better validation */}
            <NeoBrutalistModal
                isOpen={!!selectedOrder && !!selectedOrder?.id}
                onClose={() => {
                    console.log('🔒 Closing order detail modal');
                    setSelectedOrder(null);
                }}
                title={selectedOrder?.id ? `جزئیات سفارش #${selectedOrder.id}` : "جزئیات سفارش"}
                size="large"
            >
                {selectedOrder?.id ? (
                    <div style={{ direction: 'rtl' }}>
                        <div style={{
                            backgroundColor: '#e3f2fd',
                            padding: '1rem',
                            marginBottom: '1rem',
                            border: '2px solid #1976d2'
                        }}>
                            <h4 style={{ margin: 0, color: '#1976d2' }}>
                                نماینده فروش
                            </h4>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                                سفارش #{selectedOrder.id} - {selectedOrder.customer_name}
                            </p>
                        </div>

                        <DealerOrderDetailPage
                            orderId={selectedOrder.id}
                            onOrderUpdated={handleOrderUpdated}
                        />
                    </div>
                ) : (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <p>خطا: اطلاعات سفارش معتبر نیست</p>
                        <NeoBrutalistButton
                            text="بستن"
                            color="red-400"
                            textColor="white"
                            onClick={() => setSelectedOrder(null)}
                        />
                    </div>
                )}
            </NeoBrutalistModal>

            {/* Profile Modal */}
            <NeoBrutalistModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                title="پروفایل کاربری"
                size="large"
            >
                <ProfilePage />
            </NeoBrutalistModal>
        </div>
    );
};

export default DealerDashboard;