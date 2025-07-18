import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../component/Modal';
import API from '../component/api';
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
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrders();
    }, [navigate]);

    const fetchOrders = async () => {
        try {
            const response = await API.get('orders/');
            setOrders(response.data);
        } catch (error) {
            if (error.response?.status === 401) {
                navigate('/');
            } else {
                setMessage('خطا در بارگیری سفارشات!!');
            }
        }
    };

    const handleOrderCreated = () => {
        setMessage('سفارش با موفقیت ثبت شد! به زودی رسیدگی میشود');
        setShowCreateOrder(false);
        fetchOrders();
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        navigate('/');
    };

    const getUserInfo = () => {
        const userDataString = localStorage.getItem('userData');
        return userDataString ? JSON.parse(userDataString) : null;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending':
                return 'yellow-400';
            case 'in_progress':
                return 'blue-400';
            case 'completed':
                return 'green-400';
            case 'cancelled':
                return 'red-400';
            default:
                return 'gray-400';
        }
    };

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
                            <h3> ثبت {order.id}</h3>
                            <NeoBrutalistButton
                                text={formatStatus(order.status)}
                                color={getStatusColor(order.status)}
                                textColor="black"
                                className="status-badge"
                            />
                        </div>
                        <div className="order-card-info">
                            <p><strong>تاریخ ایجاد:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
                            <p><strong>جمع:</strong> ${order.quoted_total || 'Pending'}</p>
                        </div>
                        <div className="order-card-footer">
                            <NeoBrutalistButton
                                text="مشاهده جزيیات"
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
                        <h3>No Orders Yet</h3>
                        <p>You haven't created any orders yet. Click "Create New Order" to get started!</p>
                        <NeoBrutalistButton
                            text="Create Your First Order"
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
                    <CreateOrderPage onOrderCreated={handleOrderCreated} />
                </Modal>
            )}

            {selectedOrder && (
                <Modal onClose={() => setSelectedOrder(null)}>
                    <OrderDetailPage
                        orderId={selectedOrder.id}
                        onOrderUpdated={handleOrderCreated}
                    />
                </Modal>
            )}
        </div>
    );
};

const formatStatus = (status) =>
    status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

export default DashboardPage;