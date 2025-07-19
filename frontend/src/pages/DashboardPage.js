import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../component/Modal';
import API from '../component/api';
import NeoBrutalistCreateOrderPage from '../component/CreateOrderPage';
import NeoBrutalistOrderDetailPage from '../component/OrderDetailPage';
import NeoBrutalistCard from "../component/NeoBrutalist/NeoBrutalistCard";
import NeoBrutalistButton from "../component/NeoBrutalist/NeoBrutalistButton";
import '../styles/dashboard.css';

const DashboardPage = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showCreateOrder, setShowCreateOrder] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrders();
    }, [navigate]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await API.get('/orders/');
            setOrders(response.data);
        } catch (error) {
            console.error('Error fetching orders:', error);
            if (error.response?.status === 401) {
                // Token expired or invalid, redirect to login
                handleLogout();
            } else {
                setMessage('خطا در بارگیری سفارشات!!');
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
        // Clear all authentication data
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');

        // Clear axios default headers
        delete API.defaults.headers.common['Authorization'];

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
                        onClick={() => setShowCreateOrder(true)}
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
                                    e.stopPropagation();
                                    setSelectedOrder(order);
                                }}
                            />
                        </div>
                    </NeoBrutalistCard>
                ))}
            </div>

            {orders.length === 0 && (
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

            {showCreateOrder && (
                <Modal onClose={() => setShowCreateOrder(false)}>
                    <NeoBrutalistCreateOrderPage onOrderCreated={handleOrderCreated} />
                </Modal>
            )}

            {selectedOrder && (
                <Modal onClose={() => setSelectedOrder(null)}>
                    <NeoBrutalistOrderDetailPage
                        orderId={selectedOrder.id}
                        onOrderUpdated={handleOrderCreated}
                    />
                </Modal>
            )}
        </div>
    );
};

export default DashboardPage;