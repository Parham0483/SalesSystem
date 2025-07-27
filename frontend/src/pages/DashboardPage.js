import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import {useCategories} from "../hooks/useCategories";
import NeoBrutalistModal from "../component/NeoBrutalist/NeoBrutalistModal";
import CreateOrderPage from '../component/CreateOrderPage';
import OrderDetailPage from '../component/OrderDetailPage';
import NeoBrutalistCard from "../component/NeoBrutalist/NeoBrutalistCard";
import NeoBrutalistButton from "../component/NeoBrutalist/NeoBrutalistButton";
import '../styles/Main/dashboard.css';

const DashboardPage = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showCreateOrder, setShowCreateOrder] = useState(false);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('active'); // 'active', 'completed', 'rejected'
    const [recentProducts, setRecentProducts] = useState([]);
    const [recentAnnouncements, setRecentAnnouncements] = useState([]);
    const navigate = useNavigate();
    const { categories } = useCategories();

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
            fetchRecentProducts();
            fetchRecentAnnouncements();
        }
    }, [navigate]);

    const fetchOrders = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await API.get('/orders/');
            console.log('📦 Orders fetched:', response.data);
            setOrders(response.data);
        } catch (error) {
            console.error('❌ Error fetching orders:', error);
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

    const fetchRecentProducts = async () => {
        try {
            const response = await API.get('/products/new-arrivals/');
            console.log('🆕 Recent products fetched:', response.data);
            setRecentProducts(response.data.slice(0, 6)); // Show 6 recent products
        } catch (error) {
            console.error('❌ Error fetching recent products:', error);
        }
    };

    const fetchRecentAnnouncements = async () => {
        try {
            const response = await API.get('/shipment-announcements/');
            console.log('📢 Recent announcements fetched:', response.data);
            setRecentAnnouncements(response.data.slice(0, 3)); // Show 3 recent announcements
        } catch (error) {
            console.error('❌ Error fetching announcements:', error);
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
            case 'completed':
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

    const formatPrice = (price) => {
        if (!price || price === 0) return 'تماس بگیرید';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
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

                            {/* Show dealer info if assigned */}
                            {order.assigned_dealer_name && (
                                <div style={{
                                    backgroundColor: '#f3e8ff',
                                    border: '1px solid #8b5cf6',
                                    padding: '0.5rem',
                                    marginTop: '0.5rem',
                                    fontSize: '0.9rem',
                                    borderRadius: '4px'
                                }}>
                                    <div style={{ color: '#7c3aed', fontWeight: 'bold' }}>
                                        👤 نماینده فروش: {order.assigned_dealer_name}
                                    </div>
                                    {order.dealer_assigned_at && (
                                        <div style={{ fontSize: '0.8rem', color: '#6b21a8' }}>
                                            تاریخ تخصیص: {new Date(order.dealer_assigned_at).toLocaleDateString('fa-IR')}
                                        </div>
                                    )}
                                    {order.assigned_dealer_code && (
                                        <div style={{ fontSize: '0.8rem', color: '#6b21a8' }}>
                                            کد نماینده: {order.assigned_dealer_code}
                                        </div>
                                    )}
                                </div>
                            )}

                            <p style={{ marginTop: '0.5rem' }}>
                                <strong>جمع:</strong> {order.quoted_total ? `${order.quoted_total.toLocaleString('fa-IR')} ریال` : 'در انتظار قیمت‌گذاری'}
                            </p>

                            {order.customer_comment && (
                                <p><strong>توضیحات:</strong> {order.customer_comment.substring(0, 50)}...</p>
                            )}

                            {/* Show completion date for completed orders */}
                            {order.status === 'completed' && order.completion_date && (
                                <p style={{ color: '#16a34a', fontWeight: 'bold' }}>
                                    <strong>تاریخ تکمیل:</strong> {new Date(order.completion_date).toLocaleDateString('fa-IR')}
                                </p>
                            )}

                            {/* Show admin comments for customer transparency */}
                            {order.admin_comment && order.status !== 'pending_pricing' && (
                                <div style={{
                                    backgroundColor: '#fff7ed',
                                    border: '1px solid #f97316',
                                    padding: '0.5rem',
                                    marginTop: '0.5rem',
                                    fontSize: '0.85rem',
                                    borderRadius: '4px'
                                }}>
                                    <div style={{ color: '#c2410c', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                        📝 نظر مدیر:
                                    </div>
                                    <div style={{ color: '#9a3412' }}>
                                        {order.admin_comment.length > 60
                                            ? `${order.admin_comment.substring(0, 60)}...`
                                            : order.admin_comment
                                        }
                                    </div>
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

            {/* Quick Actions */}
            <div className="quick-actions-section" style={{ marginTop: '2rem' }}>
                <NeoBrutalistCard className="quick-actions-card">
                    <h3 className="actions-title">خدمات سریع</h3>
                    <div className="actions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <NeoBrutalistButton
                            text="📋 ثبت سفارش جدید"
                            color="green-400"
                            textColor="black"
                            onClick={() => setShowCreateOrder(true)}
                            className="quick-action-btn"
                        />
                        <NeoBrutalistButton
                            text="📦 کاتالوگ کامل"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/product')}
                            className="quick-action-btn"
                        />
                        <NeoBrutalistButton
                            text="🚢 محموله‌های جدید"
                            color="purple-400"
                            textColor="white"
                            onClick={() => navigate('/product/newarrivals')}
                            className="quick-action-btn"
                        />
                        <NeoBrutalistButton
                            text="📞 تماس برای استعلام"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => {
                                window.open('tel:+989123456789', '_self');
                            }}
                            className="quick-action-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            </div>

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