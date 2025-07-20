import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import NeoBrutalistModal from "../component/NeoBrutalist/NeoBrutalistModal";
import CreateOrderPage from '../component/CreateOrderPage';
import OrderDetailPage from '../component/OrderDetailPage';
import NeoBrutalistCard from "../component/NeoBrutalist/NeoBrutalistCard";
import NeoBrutalistButton from "../component/NeoBrutalist/NeoBrutalistButton";
import '../styles/dashboard.css';

const DashboardPage = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showCreateOrder, setShowCreateOrder] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        // Check authentication first
        const checkAuth = () => {
            const token = localStorage.getItem('access_token');
            const userData = localStorage.getItem('userData');

            console.log('🔍 Dashboard - Auth check:', {
                hasToken: !!token,
                hasUserData: !!userData,
                token: token ? `${token.substring(0, 20)}...` : null
            });

            if (!token || !userData) {
                console.log('❌ No authentication data found, redirecting to login');
                handleLogout();
                return false;
            }
            return true;
        };

        if (checkAuth()) {
            fetchOrders();
        }
    }, [navigate]);

    const fetchOrders = async () => {
        setLoading(true);
        setError('');

        console.log('📤 Fetching orders...');

        try {
            const response = await API.get('/orders/');
            console.log('✅ Orders fetched successfully:', response.data);
            setOrders(response.data);
        } catch (error) {
            console.error('❌ Error fetching orders:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });

            if (error.response?.status === 401) {
                console.log('🔄 401 Unauthorized - clearing auth and redirecting');
                setError('جلسه شما منقضی شده است. لطفاً دوباره وارد شوید.');
                setTimeout(() => {
                    handleLogout();
                }, 2000);
            } else if (error.response?.status === 403) {
                setError('دسترسی غیرمجاز');
            } else {
                setError('خطا در بارگیری سفارشات. لطفاً دوباره تلاش کنید.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOrderCreated = () => {
        setMessage('سفارش با موفقیت ثبت شد! به زودی رسیدگی میشود');
        setShowCreateOrder(false);
        fetchOrders();
    };

    const handleLogout = () => {
        console.log('🚪 Logging out...');

        // Clear all authentication data
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');

        // Clear axios default headers
        delete API.defaults.headers.common['Authorization'];

        console.log('✅ Auth data cleared, navigating to home');
        navigate('/');
    };

    const getUserInfo = () => {
        const userDataString = localStorage.getItem('userData');
        return userDataString ? JSON.parse(userDataString) : null;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending_pricing':
                return 'yellow-400';
            case 'waiting_customer_approval':
                return 'blue-400';
            case 'confirmed':
                return 'green-400';
            case 'rejected':
                return 'red-400';
            case 'cancelled':
                return 'gray-400';
            default:
                return 'gray-400';
        }
    };

    const formatStatus = (status) => {
        const statusMap = {
            'pending_pricing': 'در انتظار قیمت‌گذاری',
            'waiting_customer_approval': 'در انتظار تأیید',
            'confirmed': 'تأیید شده',
            'rejected': 'رد شده',
            'cancelled': 'لغو شده'
        };
        return statusMap[status] || status;
    };

    if (loading) {
        return (
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <h1>در حال بارگیری...</h1>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="user-info">
                    <h1>داشبورد</h1>
                    <span className="welcome-text">{getUserInfo()?.name} خوش آمدی</span>
                </div>
                <div className="header-actions">
                    <NeoBrutalistButton
                        text="ایجاد سفارش"
                        color="yellow-400"
                        textColor="black"
                        onClick={() => {
                            console.log('🔘 Create Order button clicked');
                            setShowCreateOrder(true);
                            console.log('📝 showCreateOrder set to true');
                        }}
                        className="create-order-btn"
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

            {message && (
                <div className="message-banner">
                    <span>{message}</span>
                    <NeoBrutalistButton
                        text="×"
                        color="white"
                        textColor="black"
                        onClick={() => setMessage('')}
                        className="close-message-btn"
                    />
                </div>
            )}

            {error && (
                <div className="message-banner" style={{ backgroundColor: '#fef2f2', borderColor: '#ef4444', color: '#dc2626' }}>
                    <span>{error}</span>
                    <NeoBrutalistButton
                        text="×"
                        color="white"
                        textColor="black"
                        onClick={() => setError('')}
                        className="close-message-btn"
                    />
                </div>
            )}

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
                            <p><strong>تاریخ ایجاد:</strong> {new Date(order.created_at).toLocaleDateString('fa-IR')}</p>
                            <p><strong>جمع:</strong> {order.quoted_total ? `$${order.quoted_total}` : 'در انتظار قیمت‌گذاری'}</p>
                            {order.customer_comment && (
                                <p><strong>توضیحات:</strong> {order.customer_comment.substring(0, 50)}...</p>
                            )}
                        </div>
                        <div className="order-card-footer">
                            <NeoBrutalistButton
                                text="مشاهده جزئیات"
                                color="blue-400"
                                textColor="white"
                                className="view-details-btn"
                                onClick={(e) => {
                                    console.log('🔘 View Details button clicked for order:', order.id);
                                    e.stopPropagation();
                                    setSelectedOrder(order);
                                    console.log('📄 selectedOrder set to:', order);
                                }}
                            />
                        </div>
                    </NeoBrutalistCard>
                ))}
            </div>

            {orders.length === 0 && !error && (
                <div className="empty-state">
                    <NeoBrutalistCard className="empty-card">
                        <h3>هنوز سفارشی ندارید</h3>
                        <p>شما هنوز هیچ سفارشی ثبت نکرده‌اید. برای شروع روی "ایجاد سفارش" کلیک کنید!</p>
                        <NeoBrutalistButton
                            text="ثبت اولین سفارش"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => setShowCreateOrder(true)}
                            className="first-order-btn"
                        />
                    </NeoBrutalistCard>
                </div>
            )}

            {/* FIXED: Added isOpen prop and title to NeoBrutalistModal */}
            <NeoBrutalistModal
                isOpen={showCreateOrder}
                onClose={() => setShowCreateOrder(false)}
                title=""
                size="large"
            >
                <CreateOrderPage onOrderCreated={handleOrderCreated} />
            </NeoBrutalistModal>

            <NeoBrutalistModal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={selectedOrder ? `جزئیات سفارش #${selectedOrder.id}` : ""}
                size="large"
            >
                {selectedOrder && (
                    <OrderDetailPage
                        orderId={selectedOrder.id}
                        onOrderUpdated={handleOrderCreated}
                    />
                )}
            </NeoBrutalistModal>
        </div>
    );
};

export default DashboardPage;