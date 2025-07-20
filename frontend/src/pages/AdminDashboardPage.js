import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../component/api';
import AdminOrderDetailPage from '../component/AdminOrderDetailPage';
import NeoBrutalistButton from '../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../component/NeoBrutalist/NeoBrutalistModal';

const AdminDashboardPage = () => {
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('active');
    const navigate = useNavigate();

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await API.get('/orders/');
            console.log('Admin orders fetched:', res.data);
            setOrders(res.data);
            setError('');
        } catch (err) {
            console.error('Error fetching orders:', err);
            if (err.response?.status === 401) {
                setError('نشست شما منقضی شده است. در حال انتقال به صفحه ورود...');
                setTimeout(() => handleLogout(), 2000);
            } else {
                setError('خطا در بارگیری سفارشات');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        // Clear all authentication data using correct key names
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');

        // Clear axios default headers
        delete API.defaults.headers.common['Authorization'];

        navigate('/');
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
            'pending_pricing': 'نیاز به قیمت‌گذاری',
            'waiting_customer_approval': 'منتظر تأیید مشتری',
            'confirmed': 'تأیید شده',
            'rejected': 'رد شده',
            'cancelled': 'لغو شده'
        };
        return statusMap[status] || status;
    };

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <h1>در حال بارگیری...</h1>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                padding: '2rem',
                backgroundColor: '#fff',
                border: '4px solid #000',
                boxShadow: '6px 6px 0px #000'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2.5rem' }}>پنل مدیریت سفارشات</h1>
                    <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
                        مجموع سفارشات: {orders.length}
                    </p>
                </div>
                <NeoBrutalistButton
                    text="خروج"
                    color="red-400"
                    textColor="white"
                    onClick={handleLogout}
                />
            </div>

            {error && (
                <div style={{
                    backgroundColor: '#fee2e2',
                    border: '4px solid #dc2626',
                    padding: '1rem',
                    marginBottom: '2rem',
                    color: '#dc2626',
                    fontWeight: 'bold'
                }}>
                    {error}
                </div>
            )}

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '2rem'
            }}>
                {orders.map(order => (
                    <NeoBrutalistCard
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div style={{
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
                                style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    minWidth: 'auto'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <p><strong>مشتری:</strong> {order.customer_name}</p>
                            <p><strong>تاریخ:</strong> {new Date(order.created_at).toLocaleDateString('fa-IR')}</p>
                            <p><strong>مبلغ:</strong> {order.quoted_total ? `$${order.quoted_total}` : 'نامشخص'}</p>
                        </div>

                        {order.customer_comment && (
                            <div style={{
                                backgroundColor: '#f8f9fa',
                                padding: '0.5rem',
                                border: '2px solid #000',
                                fontSize: '0.9rem'
                            }}>
                                <strong>نظر مشتری:</strong> {order.customer_comment.substring(0, 60)}...
                            </div>
                        )}
                    </NeoBrutalistCard>
                ))}
            </div>

            {orders.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <NeoBrutalistCard style={{ maxWidth: '400px', margin: '0 auto' }}>
                        <h3>هیچ سفارشی یافت نشد</h3>
                        <p>در حال حاضر هیچ سفارشی در سیستم موجود نیست.</p>
                        <NeoBrutalistButton
                            text="بروزرسانی"
                            color="blue-400"
                            textColor="white"
                            onClick={fetchOrders}
                        />
                    </NeoBrutalistCard>
                </div>
            )}

            {/* Order Detail Modal */}
            <NeoBrutalistModal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={selectedOrder ? `ویرایش سفارش #${selectedOrder.id}` : ""}
                size="large"
            >
                {selectedOrder && (
                    <AdminOrderDetailPage
                        orderId={selectedOrder.id}
                        onOrderUpdated={() => {
                            fetchOrders();
                            setSelectedOrder(null);
                        }}
                    />
                )}
            </NeoBrutalistModal>
        </div>
    );
};

export default AdminDashboardPage;