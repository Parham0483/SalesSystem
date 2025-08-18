import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api';
import { useCategories } from '../../hooks/useCategories';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import DealerOrderDetailPage from '../../component/DealerOrderDetailPage';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import ProfilePage from '../../component/ProfilePage';

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
    }, [navigate]);

    // Reset to first page when tab changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    const fetchAssignedOrders = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await API.get('/orders/my-assigned-orders/');
            setOrders(response.data.orders || []);
            if (response.data.summary) {
                // Handle summary if needed
            }
        } catch (err) {
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

    // filter function with new statuses
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

    const handleOrderClick = (order) => {
        setSelectedOrder(order);
    };

    const formatPrice = (price) => {
        if (!price || price === 0) return 'تماس بگیرید';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
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

    // Generate page numbers for pagination
    const getPageNumbers = () => {
        const delta = 2;
        const range = [];
        const rangeWithDots = [];

        for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
            range.push(i);
        }

        if (currentPage - delta > 2) {
            rangeWithDots.push(1, '...');
        } else {
            rangeWithDots.push(1);
        }

        rangeWithDots.push(...range);

        if (currentPage + delta < totalPages - 1) {
            rangeWithDots.push('...', totalPages);
        } else {
            rangeWithDots.push(totalPages);
        }

        return rangeWithDots.filter((item, index, array) => array.indexOf(item) === index && item !== 1 || index === 0);
    };

    if (loading) {
        return (
            <div className="dealer-dashboard" style={{ padding: '2rem', textAlign: 'center' }}>
                <div className="dashboard-header">
                    <h1>در حال بارگیری...</h1>
                    <div style={{ marginTop: '1rem', color: '#666' }}>
                        🔄 در حال دریافت سفارشات تخصیص داده شده...
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
                        {totalPages > 1 && ` - صفحه ${currentPage} از ${totalPages}`}
                    </span>
                </div>
                <div className="header-actions">
                    <NeoBrutalistButton
                        text="خروج"
                        color="red-400"
                        textColor="white"
                        onClick={handleLogout}
                        className="logout-btn"
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
                        text="پروفایل"
                        color="yellow-400"
                        textColor="black"
                        onClick={() => setShowProfileModal(true)}
                        className="profile-btn"
                    />
                </div>
            </div>

            {/* Enhanced Stats Cards */}
            {dealerStats?.stats && (
                <div className="stats-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '2rem'
                }}>
                    <NeoBrutalistCard style={{ textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#1976d2' }}>مجموع سفارشات</h3>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{dealerStats.stats.total_orders}</div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard style={{ textAlign: 'center', backgroundColor: '#f3e5f5' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#7b1fa2' }}>فعال</h3>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                            {orders.filter(o => ['pending_pricing', 'waiting_customer_approval', 'confirmed', 'payment_uploaded'].includes(o.status)).length}
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard style={{ textAlign: 'center', backgroundColor: '#e8f5e8' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#388e3c' }}>تکمیل شده</h3>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{dealerStats.stats.completed_orders}</div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard style={{ textAlign: 'center', backgroundColor: '#fff3e0' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#f57c00' }}>کمیسیون کل</h3>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                            {dealerStats.stats.total_commission_earned.toLocaleString('fa-IR')} ریال
                        </div>
                    </NeoBrutalistCard>
                </div>
            )}

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

            {/* Recent Announcements Section */}
            {recentAnnouncements.length > 0 && (
                <div className="recent-announcements-section" style={{ marginBottom: '2rem' }}>
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>🚢 آخرین محموله‌ها</h2>
                        <NeoBrutalistButton
                            text="مشاهده همه"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/product/newarrivals')}
                            className="view-all-btn"
                        />
                    </div>
                    <div className="announcements-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                        {recentAnnouncements.slice(0, 2).map(announcement => (
                            <NeoBrutalistCard
                                key={announcement.id}
                                className="announcement-preview-card"
                                onClick={() => navigate('/product/newarrivals')}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="announcement-preview-header">
                                    <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>{announcement.title}</h3>
                                    {announcement.is_featured && (
                                        <span style={{
                                            backgroundColor: '#fbbf24',
                                            color: '#000',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold'
                                        }}>
                                            ویژه
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.9rem', color: '#666', margin: '0 0 1rem 0' }}>
                                    {announcement.description.substring(0, 100)}...
                                </p>
                                {announcement.images && announcement.images.length > 0 && (
                                    <div style={{ marginBottom: '1rem' }}>
                                        <img
                                            src={announcement.images[0].image}
                                            alt={announcement.title}
                                            style={{
                                                width: '100%',
                                                height: '120px',
                                                objectFit: 'cover',
                                                borderRadius: '8px'
                                            }}
                                        />
                                    </div>
                                )}
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                    {new Date(announcement.created_at).toLocaleDateString('fa-IR')}
                                </div>
                            </NeoBrutalistCard>
                        ))}
                    </div>
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
                    text="🔄 بروزرسانی"
                    color="blue-400"
                    textColor="white"
                    onClick={fetchAssignedOrders}
                    className="refresh-btn"
                />
            </div>

            {/* Orders Grid with Pagination */}
            <div className="orders-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '2rem',
                marginBottom: '2rem'
            }}>
                {currentOrders.map((order) => (
                    <NeoBrutalistCard
                        key={order.id}
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

                            {/* Show who priced the order */}
                            {order.priced_by_name && (
                                <div style={{
                                    backgroundColor: '#e0f2fe',
                                    border: '1px solid #0284c7',
                                    padding: '0.5rem',
                                    marginTop: '0.5rem',
                                    fontSize: '0.9rem',
                                    borderRadius: '4px'
                                }}>
                                    <div style={{ color: '#0369a1', fontWeight: 'bold' }}>
                                        💼 قیمت‌گذاری توسط: {order.priced_by_name}
                                    </div>
                                    {order.pricing_date && (
                                        <div style={{ fontSize: '0.8rem', color: '#0284c7' }}>
                                            تاریخ: {new Date(order.pricing_date).toLocaleDateString('fa-IR')}
                                        </div>
                                    )}
                                </div>
                            )}

                            {order.quoted_total > 0 && (
                                <p><strong>مبلغ:</strong> {order.quoted_total.toLocaleString('fa-IR')} ریال</p>
                            )}
                            {order.dealer_assigned_at && (
                                <p><strong>تاریخ تخصیص:</strong> {new Date(order.dealer_assigned_at).toLocaleDateString('fa-IR')}</p>
                            )}

                            {/* Show payment upload status */}
                            {order.status === 'payment_uploaded' && order.has_payment_receipts && (
                                <div style={{
                                    backgroundColor: '#f3e8ff',
                                    border: '1px solid #8b5cf6',
                                    padding: '0.5rem',
                                    marginTop: '0.5rem',
                                    fontSize: '0.85rem',
                                    borderRadius: '4px'
                                }}>
                                    <div style={{ color: '#7c3aed', fontWeight: 'bold' }}>
                                        📄 رسید پرداخت آپلود شده
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#6b21a8' }}>
                                        در انتظار بررسی مدیر
                                    </div>
                                </div>
                            )}

                            {/* Show completion date for completed orders */}
                            {order.status === 'completed' && order.completion_date && (
                                <div style={{
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #16a34a',
                                    padding: '0.5rem',
                                    marginTop: '0.5rem',
                                    fontSize: '0.85rem',
                                    borderRadius: '4px'
                                }}>
                                    <div style={{ color: '#16a34a', fontWeight: 'bold' }}>
                                        ✅ تاریخ تکمیل: {new Date(order.completion_date).toLocaleDateString('fa-IR')}
                                    </div>
                                </div>
                            )}

                            {/* Enhanced commission info */}
                            {order.effective_commission_rate > 0 && (
                                <div style={{
                                    backgroundColor: '#f0f9ff',
                                    border: '1px solid #0284c7',
                                    padding: '0.5rem',
                                    marginTop: '0.5rem',
                                    fontSize: '0.9rem'
                                }}>
                                    <div style={{ color: '#0369a1', fontWeight: 'bold' }}>
                                        💰 اطلاعات کمیسیون:
                                    </div>
                                    <div>
                                        <strong>نرخ:</strong> {order.effective_commission_rate}%
                                        {order.has_custom_commission && (
                                            <span style={{ color: '#dc2626', fontSize: '0.8rem' }}> (سفارشی)</span>
                                        )}
                                    </div>
                                    {order.dealer_commission_amount > 0 && (
                                        <div style={{ color: '#16a34a', fontWeight: 'bold' }}>
                                            <strong>مبلغ کمیسیون:</strong> {order.dealer_commission_amount.toLocaleString('fa-IR')} ریال
                                        </div>
                                    )}
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
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <NeoBrutalistCard className="pagination-card" style={{ marginBottom: '2rem' }}>
                    <div className="pagination-container" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        padding: '1rem'
                    }}>
                        <div className="pagination-info">
                            <span>صفحه {currentPage} از {totalPages}</span>
                            <span> ({filteredOrders.length} سفارش)</span>
                        </div>

                        <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <NeoBrutalistButton
                                text="قبلی"
                                color="gray-400"
                                textColor="black"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="pagination-btn"
                            />

                            <div className="page-numbers" style={{ display: 'flex', gap: '0.25rem' }}>
                                {getPageNumbers().map((pageNumber, index) => (
                                    pageNumber === '...' ? (
                                        <span key={index} style={{ padding: '0.5rem' }}>...</span>
                                    ) : (
                                        <NeoBrutalistButton
                                            key={index}
                                            text={pageNumber.toString()}
                                            color={currentPage === pageNumber ? "blue-400" : "gray-200"}
                                            textColor={currentPage === pageNumber ? "white" : "black"}
                                            onClick={() => handlePageChange(pageNumber)}
                                            className="page-number-btn"
                                            style={{ minWidth: '40px', padding: '0.5rem' }}
                                        />
                                    )
                                ))}
                            </div>

                            <NeoBrutalistButton
                                text="بعدی"
                                color="gray-400"
                                textColor="black"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="pagination-btn"
                            />
                        </div>

                        <div className="pagination-jump" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>برو به صفحه:</span>
                            <select
                                value={currentPage}
                                onChange={(e) => handlePageChange(parseInt(e.target.value))}
                                style={{
                                    padding: '0.5rem',
                                    border: '2px solid #000',
                                    borderRadius: '4px',
                                    backgroundColor: '#fff'
                                }}
                            >
                                {Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
                                    <option key={page} value={page}>صفحه {page}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </NeoBrutalistCard>
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
                        <h3>
                            {activeTab === 'active' && 'هیچ سفارش فعالی ندارید'}
                            {activeTab === 'completed' && 'هیچ سفارش تکمیل شده‌ای ندارید'}
                            {activeTab === 'rejected' && 'هیچ سفارش رد شده‌ای ندارید'}
                        </h3>
                        <p>
                            {activeTab === 'active' && 'سفارشات تخصیص داده شده در اینجا نمایش داده می‌شود.'}
                            {activeTab === 'completed' && 'سفارشات تکمیل شده شما در اینجا نمایش داده می‌شود.'}
                            {activeTab === 'rejected' && 'سفارشات رد شده یا لغو شده شما در اینجا نمایش داده می‌شود.'}
                        </p>
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

            {/* Quick Actions */}
            <div className="quick-actions-section" style={{ marginTop: '2rem' }}>
                <NeoBrutalistCard className="quick-actions-card">
                    <h3 className="actions-title">خدمات سریع</h3>
                    <div className="actions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <NeoBrutalistButton
                            text="📦 کاتالوگ کامل"
                            color="purple-400"
                            textColor="white"
                            onClick={() => navigate('/product')}
                            className="quick-action-btn"
                        />
                        <NeoBrutalistButton
                            text="🚢 محموله‌های جدید"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/product/newarrivals')}
                            className="quick-action-btn"
                        />
                        <NeoBrutalistButton
                            text="📞 تماس برای پشتیبانی"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => {
                                window.open('tel:+989123456789', '_self');
                            }}
                            className="quick-action-btn"
                        />
                        <NeoBrutalistButton
                            text="🔄 بروزرسانی سفارشات"
                            color="green-400"
                            textColor="black"
                            onClick={fetchAssignedOrders}
                            className="quick-action-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            </div>

            {/* Order Detail Modal */}
            <NeoBrutalistModal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={selectedOrder ? `جزئیات سفارش #${selectedOrder.id}` : ""}
                size="large"
            >
                {selectedOrder && (
                    <div style={{ direction: 'rtl' }}>
                        <div style={{
                            backgroundColor: '#e3f2fd',
                            padding: '1rem',
                            marginBottom: '1rem',
                            border: '2px solid #1976d2'
                        }}>
                            <h4 style={{ margin: 0, color: '#1976d2' }}>
                                🏢 نمایش نماینده فروش
                            </h4>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                                جزئیات کامل سفارش با اطلاعات کمیسیون و قیمت‌گذار
                            </p>
                        </div>

                        <DealerOrderDetailPage
                            orderId={selectedOrder.id}
                            onOrderUpdated={() => {
                                fetchAssignedOrders();
                                setSelectedOrder(null);
                            }}
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