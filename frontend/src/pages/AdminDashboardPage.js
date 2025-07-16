import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import Modal from '../component/Modal';
import AdminOrderDetailPage from '../component/AdminOrderDetailPage';

const AdminDashboardPage = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const res = await API.get('/orders/');
            setOrders(res.data);
        } catch (err) {
            if (err.response?.status === 401) {
                navigate('/');
            }
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        navigate('/');
    };

    return (
        <div>
            <h1>Admin Orders</h1>
            <button onClick={handleLogout}>Logout</button>
            <div>
                {orders.map(order => (
                    <div key={order.id} style={{ border: '1px solid #ccc', margin: 8, padding: 8 }}
                         onClick={() => setSelectedOrder(order)}>
                        <strong>Order #{order.id}</strong> - Status: {order.status}
                    </div>
                ))}
            </div>

            {selectedOrder && (
                <Modal onClose={() => setSelectedOrder(null)}>
                    <AdminOrderDetailPage
                        orderId={selectedOrder.id}
                        onOrderUpdated= {() => {
                            fetchOrders();
                            setSelectedOrder(null);
                        }}
                    />
                </Modal>
            )}
        </div>
    );
};

export default AdminDashboardPage;
