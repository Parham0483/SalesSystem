// Enhanced DashboardPage.js with completed orders section

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
    const [activeTab, setActiveTab] = useState('active'); // 'active', 'completed', 'rejected'
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('access_token');
            const userData = localStorage.getItem('userData');

            if (!token || !userData) {
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

        try {
            const response = await API.get('/orders/');
            setOrders(response.data);
        } catch (error) {
            if (error.response?.status === 401) {
                setError('جلسه شما منقضی شده است. لطفاً دوباره وارد شوید.');
                setTimeout(() => handleLogout(), 2000);
            } else {
                setError('خطا در بارگیری سفارشات. لطفاً دوباره تلاش کنید.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Filter orders by status
    const getFilteredOrders = () => {
        switch (activeTab) {
            case 'active':
                return orders.filter(order =>
                    ['pending_pricing', 'waiting_customer_approval', 'confirmed'].includes(order.status)
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

    const handleOrderCreated = () => {
        setMessage('سفارش با موفقیت ثبت شد! به زودی رسیدگی میشود');
        setShowCreateOrder(false);
        fetchOrders();
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
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
            case 'completed':  // ✅ Add completed status
                return 'green-600';
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
            'completed': 'تکمیل شده',
            'rejected': 'رد شده',
            'cancelled': 'لغو شده'
        };
        return statusMap[status] || status;
    };

    // Download PDF function for completed orders
    const handleDownloadPDF = async (order, e) => {
        e.stopPropagation();
        try {
            if (!order.invoice_id) {
                setError('فاکتور برای این سفارش موجود نیست');
                return;
            }

            const response = await API.get(`/invoices/${order.invoice_id}/download-pdf/`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `invoice_${order.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            setError('خطا در دانلود فاکتور');
        }
    };

    const filteredOrders = getFilteredOrders();

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
            {/* Header */}
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

            {/* Messages */}
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

            {/* Order Tabs */}
            <div className="dashboard-tabs">
                <NeoBrutalistButton
                    text={`سفارشات فعال (${orders.filter(o => ['pending_pricing', 'waiting_customer_approval', 'confirmed'].includes(o.status)).length})`}
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
            </div>

            {/* Orders Grid */}
            <div className="orders-grid">
                {filteredOrders.map((order) => (
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
                            <p><strong>جمع:</strong> {order.quoted_total ? `${order.quoted_total.toLocaleString('fa-IR')} ریال` : 'در انتظار قیمت‌گذاری'}</p>
                            {order.customer_comment && (
                                <p><strong>توضیحات:</strong> {order.customer_comment.substring(0, 50)}...</p>
                            )}
                            {/* Show completion date for completed orders */}
                            {order.status === 'completed' && order.completion_date && (
                                <p><strong>تاریخ تکمیل:</strong> {new Date(order.completion_date).toLocaleDateString('fa-IR')}</p>
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
                            {/* Download PDF button for completed orders */}
                            {order.status === 'completed' && order.invoice_id && (
                                <NeoBrutalistButton
                                    text="دانلود فاکتور"
                                    color="green-400"
                                    textColor="white"
                                    className="download-btn"
                                    onClick={(e) => handleDownloadPDF(order, e)}
                                />
                            )}
                        </div>
                    </NeoBrutalistCard>
                ))}
            </div>

            {/* Empty State */}
            {filteredOrders.length === 0 && !error && (
                <div className="empty-state">
                    <NeoBrutalistCard className="empty-card">
                        <h3>
                            {activeTab === 'active' && 'هیچ سفارش فعالی ندارید'}
                            {activeTab === 'completed' && 'هیچ سفارش تکمیل شده‌ای ندارید'}
                            {activeTab === 'rejected' && 'هیچ سفارش رد شده‌ای ندارید'}
                        </h3>
                        <p>
                            {activeTab === 'active' && 'برای شروع روی "ایجاد سفارش" کلیک کنید!'}
                            {activeTab === 'completed' && 'سفارشات تکمیل شده شما در اینجا نمایش داده می‌شود.'}
                            {activeTab === 'rejected' && 'سفارشات رد شده یا لغو شده شما در اینجا نمایش داده می‌شود.'}
                        </p>
                        {activeTab === 'active' && (
                            <NeoBrutalistButton
                                text="ثبت اولین سفارش"
                                color="yellow-400"
                                textColor="black"
                                onClick={() => setShowCreateOrder(true)}
                                className="first-order-btn"
                            />
                        )}
                    </NeoBrutalistCard>
                </div>
            )}

            {/* Modals */}
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