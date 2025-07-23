import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import NeoBrutalistCard from '../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../component/NeoBrutalist/NeoBrutalistButton';
import DealerOrderDetailPage from '../component/DealerOrderDetailPage';
import NeoBrutalistModal from '../component/NeoBrutalist/NeoBrutalistModal';

const DealerDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [dealerStats, setDealerStats] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const userDataString = localStorage.getItem('userData');
        const user = userDataString ? JSON.parse(userDataString) : null;

        console.log('🔍 Dealer Dashboard - User check:', {
            hasUser: !!user,
            isDealer: user?.is_dealer,
            userName: user?.name
        });

        if (!user || (!user.is_dealer && !user.is_staff)) {
            console.log('❌ Access denied - redirecting to login');
            navigate('/login');
            return;
        }

        fetchAssignedOrders();
        fetchDealerStats();
    }, [navigate]);

    const fetchAssignedOrders = async () => {
        setLoading(true);
        setError('');

        try {
            console.log('📤 Fetching assigned orders...');
            const response = await API.get('/orders/my-assigned-orders/');
            console.log('✅ Assigned orders response:', response.data);

            setOrders(response.data.orders || []);

            if (response.data.summary) {
                console.log('📊 Order summary:', response.data.summary);
            }

        } catch (err) {
            console.error('❌ Error fetching assigned orders:', err);
            console.log('❌ Error details:', {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message
            });

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
            console.log('📤 Fetching dealer stats...');
            const response = await API.get('/orders/dealer-dashboard-stats/');
            console.log('✅ Dealer stats:', response.data);
            setDealerStats(response.data);
        } catch (err) {
            console.error('❌ Error fetching dealer stats:', err);
            // Stats are optional, don't show error for this
        }
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
            'pending_pricing': 'در انتظار قیمت‌گذاری',
            'waiting_customer_approval': 'در انتظار تأیید مشتری',
            'confirmed': 'تأیید شده',
            'completed': 'تکمیل شده',
            'rejected': 'رد شده',
            'cancelled': 'لغو شده'
        };
        return statusMap[status] || status;
    };

    const handleOrderClick = (order) => {
        console.log('🎯 Order clicked:', {
            orderId: order.id,
            status: order.status,
            hasDealer: order.has_dealer,
            dealerName: order.assigned_dealer_name
        });
        setSelectedOrder(order);
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
                        سفارشات تخصیص داده شده
                        {dealerStats?.dealer && ` - ${dealerStats.dealer.name}`}
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
                </div>
            </div>

            {/* Stats Cards - Removed commission rate as requested */}
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
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#7b1fa2' }}>تکمیل شده</h3>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{dealerStats.stats.completed_orders}</div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard style={{ textAlign: 'center', backgroundColor: '#e8f5e8' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', color: '#388e3c' }}>کمیسیون کل</h3>
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

            {/* Orders Grid */}
            <div className="orders-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '2rem'
            }}>
                {orders.map((order) => (
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
                                <p><strong>قیمت‌گذاری توسط:</strong> {order.priced_by_name}</p>
                            )}

                            {order.quoted_total > 0 && (
                                <p><strong>مبلغ:</strong> {order.quoted_total.toLocaleString('fa-IR')} ریال</p>
                            )}
                            {order.dealer_assigned_at && (
                                <p><strong>تاریخ تخصیص:</strong> {new Date(order.dealer_assigned_at).toLocaleDateString('fa-IR')}</p>
                            )}

                            {/* Enhanced commission info - shows per-order commission rate */}
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

            {/* Empty State */}
            {orders.length === 0 && !error && (
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
                        <h3>هیچ سفارشی تخصیص نیافته</h3>
                        <p>تا کنون هیچ سفارشی به شما تخصیص داده نشده است.</p>
                        <NeoBrutalistButton
                            text="بروزرسانی"
                            color="blue-400"
                            textColor="white"
                            onClick={fetchAssignedOrders}
                            style={{ marginTop: '1rem' }}
                        />
                    </NeoBrutalistCard>
                </div>
            )}

            {/* Order Detail Modal - Now using DealerOrderDetailPage */}
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
        </div>
    );
};

export default DealerDashboard;