import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistModal from '../../component/NeoBrutalist/NeoBrutalistModal';
import NeoBrutalistInput from '../../component/NeoBrutalist/NeoBrutalistInput';
//import '../../styles/Admin/AdminCustomers.css';

const AdminCustomersPage = () => {
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerDetails, setCustomerDetails] = useState(null);
    const [isDetailLoading, setIsDetailLoading] = useState(false);

    // Filtering and Sorting State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all', 'customers', 'dealers', 'staff'

    const navigate = useNavigate();

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const response = await API.get('/admin/customers/');
            setCustomers(response.data);
            setError('');
        } catch (err) {
            console.error('❌ Error fetching customers:', err);
            setError('خطا در بارگیری لیست کاربران');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCustomers();
    }, [fetchCustomers]);

    useEffect(() => {
        let filtered = [...customers];

        // Search filter
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(lowercasedTerm) ||
                c.email.toLowerCase().includes(lowercasedTerm) ||
                (c.company_name && c.company_name.toLowerCase().includes(lowercasedTerm))
            );
        }

        // Type filter
        if (filterType !== 'all') {
            filtered = filtered.filter(c => {
                if (filterType === 'customers') return !c.is_dealer && !c.is_staff;
                if (filterType === 'dealers') return c.is_dealer;
                if (filterType === 'staff') return c.is_staff;
                return true;
            });
        }

        setFilteredCustomers(filtered);
    }, [customers, searchTerm, filterType]);

    const handleToggleStatus = async (customerId, currentStatus) => {
        try {
            await API.post(`/admin/customers/${customerId}/toggle-status/`);
            // Optimistically update UI or refetch
            setCustomers(prev =>
                prev.map(c =>
                    c.id === customerId ? { ...c, is_active: !currentStatus } : c
                )
            );
        } catch (err) {
            console.error('Error toggling customer status', err);
            setError('خطا در تغییر وضعیت کاربر');
        }
    };

    const handleViewDetails = async (customer) => {
        setSelectedCustomer(customer);
        setIsModalOpen(true);
        setIsDetailLoading(true);
        try {
            const response = await API.get(`/admin/customers/${customer.id}/orders/`);
            setCustomerDetails(response.data);
        } catch (err) {
            console.error('Error fetching customer details', err);
            setError('خطا در بارگیری جزئیات مشتری');
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCustomer(null);
        setCustomerDetails(null);
    };

    if (loading) return <div className="admin-page-container"><h1>در حال بارگیری کاربران...</h1></div>;

    return (
        <div className="admin-page-container admin-customers-page" dir="rtl">
            <div className="page-header">
                <h1>👥 مدیریت کاربران</h1>
                <NeoBrutalistButton
                    text="داشبورد"
                    color="blue-400"
                    textColor="white"
                    onClick={() => navigate('/admin')}
                />
            </div>

            {error && <div className="error-banner">⚠️ {error}</div>}

            <NeoBrutalistCard className="filters-card">
                <div className="filters-grid">
                    <NeoBrutalistInput
                        type="text"
                        placeholder="جستجو در نام، ایمیل، شرکت..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
                        <option value="all">همه کاربران</option>
                        <option value="customers">مشتریان عادی</option>
                        <option value="dealers">نمایندگان</option>
                        <option value="staff">کارمندان</option>
                    </select>
                </div>
            </NeoBrutalistCard>

            <div className="customers-grid">
                {filteredCustomers.map(customer => (
                    <NeoBrutalistCard key={customer.id} className={`customer-card ${!customer.is_active ? 'inactive' : ''} ${customer.is_dealer ? 'dealer' : ''}`}>
                        <div className="card-header">
                            <div className="customer-identity">
                                <h3 className="customer-name">{customer.name}</h3>
                                <span className="customer-email">{customer.email}</span>
                            </div>
                            <div className="customer-tags">
                                {customer.is_dealer && <span className="tag dealer-tag">نماینده</span>}
                                {customer.is_staff && <span className="tag staff-tag">کارمند</span>}
                            </div>
                        </div>
                        <div className="customer-details">
                            {customer.company_name && <p><strong>شرکت:</strong> {customer.company_name}</p>}
                            <p><strong>تاریخ عضویت:</strong> {new Date(customer.date_joined).toLocaleDateString('fa-IR')}</p>
                        </div>
                        <div className="card-footer">
                            <label className="switch">
                                <input type="checkbox" checked={customer.is_active} onChange={() => handleToggleStatus(customer.id, customer.is_active)} />
                                <span className="slider round"></span>
                                <span className="switch-label">{customer.is_active ? 'فعال' : 'غیرفعال'}</span>
                            </label>
                            <NeoBrutalistButton
                                text="مشاهده جزئیات"
                                color="yellow-400"
                                textColor="black"
                                onClick={() => handleViewDetails(customer)}
                            />
                        </div>
                    </NeoBrutalistCard>
                ))}
            </div>

            {filteredCustomers.length === 0 && !loading && (
                <NeoBrutalistCard className="empty-state-card">
                    <p>کاربری با مشخصات وارد شده یافت نشد.</p>
                </NeoBrutalistCard>
            )}

            <NeoBrutalistModal isOpen={isModalOpen} onClose={handleCloseModal} title={selectedCustomer ? `جزئیات کاربر: ${selectedCustomer.name}` : ''}>
                {isDetailLoading ? (
                    <p>در حال بارگیری جزئیات...</p>
                ) : customerDetails ? (
                    <div className="customer-detail-modal">
                        <NeoBrutalistCard className="detail-section">
                            <h4>اطلاعات اصلی</h4>
                            <p><strong>نام:</strong> {customerDetails.customer.name}</p>
                            <p><strong>ایمیل:</strong> {customerDetails.customer.email}</p>
                            <p><strong>تلفن:</strong> {customerDetails.customer.phone_number || 'ثبت نشده'}</p>
                            <p><strong>شرکت:</strong> {customerDetails.customer.company_name || 'ثبت نشده'}</p>
                        </NeoBrutalistCard>
                        <NeoBrutalistCard className="detail-section">
                            <h4>آمار کلی</h4>
                            <p><strong>تعداد کل سفارشات:</strong> {customerDetails.total_orders}</p>
                            <p><strong>مجموع خرید (تکمیل شده):</strong> {customerDetails.total_spent.toLocaleString('fa-IR')} ریال</p>
                        </NeoBrutalistCard>
                        <NeoBrutalistCard className="detail-section">
                            <h4>تاریخچه سفارشات</h4>
                            {customerDetails.orders.length > 0 ? (
                                <ul className="order-history-list">
                                    {customerDetails.orders.map(order => (
                                        <li key={order.id}>
                                            <span>سفارش #{order.id} - {new Date(order.created_at).toLocaleDateString('fa-IR')}</span>
                                            <span className={`status-pill ${order.status}`}>{order.status}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p>این کاربر هنوز سفارشی ثبت نکرده است.</p>
                            )}
                        </NeoBrutalistCard>
                    </div>
                ) : (
                    <p>اطلاعاتی برای نمایش وجود ندارد.</p>
                )}
            </NeoBrutalistModal>
        </div>
    );
};

export default AdminCustomersPage;
