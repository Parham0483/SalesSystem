import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../component/Modal';
import API from '../component/api'

const DashboardPage = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showCreateOrder, setShowCreateOrder] = useState(false);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    // Setup axios configuration and check authentication
    useEffect(() => {
    fetchOrders();
}, [navigate]);

const fetchOrders = async () => {
    try {
        const response = await API.get('orders/');
        setOrders(response.data);
    } catch (error) {
        console.error("Fetch orders error:", error);
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            navigate('/login');
        } else {
            setMessage('Error loading orders');
        }
    }
};

const handleCreateOrder = async (orderData) => {
    try {
        await API.post('orders/', orderData);
        setMessage('Order submitted successfully! We will provide the pricing soon.');
        setShowCreateOrder(false);
        fetchOrders(); // Refresh orders list
    } catch (error) {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('userData');
            navigate('/login');
        } else {
            setMessage('Error creating order');
        }
    }
};

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        navigate('/login');
    };

    const getUserInfo = () => {
        const userDataString = localStorage.getItem('userData');
        return userDataString ? JSON.parse(userDataString) : null;
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div className="user-info">
                    <h1>My Orders</h1>
                    <span>Welcome, {getUserInfo()?.name}</span>
                </div>
                <div className="header-actions">
                    <button
                        className="create-order-button"
                        onClick={() => setShowCreateOrder(true)}
                    >
                        Create New Order
                    </button>
                    <button
                        className="logout-button"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>
                </div>
            </div>

            {message && (
                <div className="message-banner">
                    {message}
                    <button onClick={() => setMessage('')}>×</button>
                </div>
            )}

            <div className="orders-list">
                {orders.map((order) => (
                    <div
                        key={order.id}
                        className="order-card"
                        onClick={() => setSelectedOrder(order)}
                    >
                        <div className="order-header">
                            <h3>Order #{order.id}</h3>
                            <span className={`status-badge ${order.status}`}>
                                {formatStatus(order.status)}
                            </span>
                        </div>
                        <div className="order-info">
                            <p>Created: {new Date(order.created_at).toLocaleDateString()}</p>
                            <p>Total: ${order.quoted_total}</p>
                        </div>
                    </div>
                ))}
            </div>

            {showCreateOrder && (
                <Modal onClose={() => setShowCreateOrder(false)}>
                    {/* Your Create Order Form Component */}
                </Modal>
            )}

            {selectedOrder && (
                <Modal onClose={() => setSelectedOrder(null)}>
                    {/* Your Order Details Component */}
                </Modal>
            )}
        </div>
    );
};

const formatStatus = (status) => {
    return status.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
};

export default DashboardPage;