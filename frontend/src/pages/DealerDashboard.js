
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import NeoBrutalistCard from '../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from '../component/NeoBrutalist/NeoBrutalistButton';
import OrderDetailPage from '../component/OrderDetailPage';
import NeoBrutalistModal from '../component/NeoBrutalist/NeoBrutalistModal';

const DealerDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const userDataString = localStorage.getItem('userData');
        const user = userDataString ? JSON.parse(userDataString) : null;

        if (!user || !user.is_dealer) {
            navigate('/login');
            return;
        }

        fetchAssignedOrders();
    }, [navigate]);

    const fetchAssignedOrders = async () => {
        setLoading(true);
        try {
            const response = await API.get('/orders/my-assigned-orders/');
            setOrders(response.data.orders);
        } catch (err) {
            console.error('Error fetching assigned orders:', err);
            setError('خطا در بارگیری سفارشات');
        } finally {
            setLoading(false);
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

    if (loading) {
        return (
            <div className="dealer-dashboard">
                <div className="dashboard-header">
                    <h1>در حال بارگیری...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="dealer-dashboard">
            {/* Header */}
            <div className="dashboard-header">
                <div className="user-info">
                    <h1>پنل نماینده فروش</h1>
                    <span className="welcome-text">سفارشات تخصیص داده شده</span>
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

            {error && (
                <div className="error-banner">
                    <span>{error}</span>
                </div>
            )}

            {/* Orders Grid */}
            <div className="orders-grid">
                {orders.map((order) => (
                    <NeoBrutalistCard
                        key={order.id}
                        className="order-card"
                        onClick={() => setSelectedOrder(order)}
                    >
                        <div className="order-card-header">
                            <h3>سفارش #{order.id}</h3>
                            <NeoBrutalistButton
                                text={formatStatus(order.status)}
                                color={getStatusColor(order.status)}
                                textColor="black"
                                className="status-badge"
                            />
                        </div>

                        <div className="order-card-info">
                            <p><strong>مشتری:</strong> {order.customer_name}</p>
                            <p><strong>تاریخ ایجاد:</strong> {new Date(order.created_at).toLocaleDateString('fa-IR')}</p>
                            {order.quoted_total > 0 && (
                                <p><strong>مبلغ:</strong> {order.quoted_total.toLocaleString('fa-IR')} ریال</p>
                            )}
                            {order.dealer_assigned_at && (
                                <p><strong>تاریخ تخصیص:</strong> {new Date(order.dealer_assigned_at).toLocaleDateString('fa-IR')}</p>
                            )}
                        </div>

                        <div className="order-card-footer">
                            <NeoBrutalistButton
                                text="مشاهده جزئیات"
                                color="blue-400"
                                textColor="white"
                                className="view-details-btn"
                            />
                        </div>
                    </NeoBrutalistCard>
                ))}
            </div>

            {/* Empty State */}
            {orders.length === 0 && (
                <div className="empty-state">
                    <NeoBrutalistCard className="empty-card">
                        <h3>هیچ سفارشی تخصیص نیافته</h3>
                        <p>تا کنون هیچ سفارشی به شما تخصیص داده نشده است.</p>
                    </NeoBrutalistCard>
                </div>
            )}

            {/* Order Detail Modal */}
            <NeoBrutalistModal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={selectedOrder ? `جزئیات سفارش #${selectedOrder.id}` : ""}
                size="large"
            >
                {selectedOrder && (
                    <OrderDetailPage
                        orderId={selectedOrder.id}
                        onOrderUpdated={fetchAssignedOrders}
                    />
                )}
            </NeoBrutalistModal>
        </div>
    );
};

export default DealerDashboard;