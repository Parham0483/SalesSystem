// src/pages/ProfilePage.js - Main Profile Page
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistModal from './NeoBrutalist/NeoBrutalistModal';
import '../styles/component/profile.css'

const ProfilePage = ({ isModal = false }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'orders', 'notifications', 'security'
    const [editing, setEditing] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [ordersData, setOrdersData] = useState(null);
    const [notificationsData, setNotificationsData] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        company_name: ''
    });

    const navigate = useNavigate();

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        if (activeTab === 'orders' && !ordersData) {
            fetchOrdersSummary();
        } else if (activeTab === 'notifications' && !notificationsData) {
            fetchNotifications();
        }
    }, [activeTab]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const response = await API.get('/profile/me/');
            console.log('👤 Profile fetched:', response.data);
            setProfile(response.data.profile);
            setFormData({
                name: response.data.profile.name,
                phone: response.data.profile.phone || '',
                company_name: response.data.profile.company_name || ''
            });
        } catch (error) {
            console.error('❌ Error fetching profile:', error);
            if (error.response?.status === 401) {
                handleLogout();
            } else {
                setError('خطا در بارگیری اطلاعات پروفایل');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchOrdersSummary = async () => {
        try {
            const response = await API.get('/profile/orders-summary/');
            console.log('📊 Orders summary fetched:', response.data);
            setOrdersData(response.data);
        } catch (error) {
            console.error('❌ Error fetching orders summary:', error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const response = await API.get('/profile/notifications-history/');
            console.log('🔔 Notifications fetched:', response.data);
            setNotificationsData(response.data);
        } catch (error) {
            console.error('❌ Error fetching notifications:', error);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            const response = await API.put('/profile/update/', formData);
            console.log('✅ Profile updated:', response.data);
            setProfile({ ...profile, ...response.data.profile });
            setEditing(false);
            setMessage('پروفایل با موفقیت به‌روزرسانی شد');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('❌ Error updating profile:', error);
            setError('خطا در به‌روزرسانی پروفایل');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    const formatPrice = (price) => {
        if (!price || price === 0) return '0';
        return `${parseFloat(price).toLocaleString('fa-IR')} ریال`;
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'email': return '📧';
            case 'sms': return '📱';
            default: return '🔔';
        }
    };

    const getNotificationTypeText = (emailType, smsType) => {
        const types = {
            'order_submitted': 'ثبت سفارش',
            'pricing_ready': 'آماده‌سازی قیمت',
            'order_confirmed': 'تأیید سفارش',
            'order_rejected': 'رد سفارش',
            'order_completed': 'تکمیل سفارش',
            'dealer_assigned': 'تخصیص نماینده',
            'new_arrival_customer': 'محموله جدید',
            'new_arrival_dealer': 'محموله جدید - نماینده',
        };
        return types[emailType || smsType] || (emailType || smsType);
    };

    if (loading) {
        return (
            <div className="profile-container">
                <div className="profile-header">
                    <h1>در حال بارگیری...</h1>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="profile-container">
                <div className="profile-header">
                    <h1>خطا در بارگیری پروفایل</h1>
                    <NeoBrutalistButton
                        text="بازگشت به داشبورد"
                        color="blue-400"
                        textColor="white"
                        onClick={() => navigate('/dashboard')}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="profile-container">
            {/* Conditionally render the header */}
            {!isModal && (
            <div className="profile-header">
                <div className="profile-title">
                    <h1>پروفایل کاربری</h1>
                    <span className="profile-subtitle">{profile.name}</span>
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
            )}
            {/* Messages */}
            {message && (
                <div className="message-banner success">
                    <span>{message}</span>
                    <NeoBrutalistButton
                        text="×"
                        color="white"
                        textColor="black"
                        onClick={() => setMessage('')}
                        className="close-btn"
                    />
                </div>
            )}

            {error && (
                <div className="message-banner error">
                    <span>{error}</span>
                    <NeoBrutalistButton
                        text="×"
                        color="white"
                        textColor="black"
                        onClick={() => setError('')}
                        className="close-btn"
                    />
                </div>
            )}

            {/* Tabs */}
            <div className="profile-tabs">
                <NeoBrutalistButton
                    text="اطلاعات شخصی"
                    color={activeTab === 'profile' ? 'yellow-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('profile')}
                    className="tab-btn"
                />
                <NeoBrutalistButton
                    text="خلاصه سفارشات"
                    color={activeTab === 'orders' ? 'yellow-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('orders')}
                    className="tab-btn"
                />
                <NeoBrutalistButton
                    text="تاریخچه اطلاع‌رسانی"
                    color={activeTab === 'notifications' ? 'yellow-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('notifications')}
                    className="tab-btn"
                />
                <NeoBrutalistButton
                    text="امنیت"
                    color={activeTab === 'security' ? 'yellow-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('security')}
                    className="tab-btn"
                />
            </div>

            {/* Tab Content */}
            <div className="profile-content">
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <div className="profile-tab">
                        <NeoBrutalistCard className="profile-info-card">
                            <div className="card-header">
                                <h2>اطلاعات شخصی</h2>
                                <NeoBrutalistButton
                                    text={editing ? 'لغو' : 'ویرایش'}
                                    color={editing ? 'red-400' : 'blue-400'}
                                    textColor="white"
                                    onClick={() => {
                                        setEditing(!editing);
                                        if (editing) {
                                            // Reset form data
                                            setFormData({
                                                name: profile.name,
                                                phone: profile.phone || '',
                                                company_name: profile.company_name || ''
                                            });
                                        }
                                    }}
                                />
                            </div>

                            {editing ? (
                                <form onSubmit={handleUpdateProfile} className="profile-form">
                                    <div className="form-group">
                                        <label>نام:</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            className="form-input"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>شماره تماس:</label>
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="09121234567"
                                            className="form-input"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>نام شرکت:</label>
                                        <input
                                            type="text"
                                            value={formData.company_name}
                                            onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                            className="form-input"
                                        />
                                    </div>

                                    <div className="form-actions">
                                        <NeoBrutalistButton
                                            text="ذخیره تغییرات"
                                            color="green-400"
                                            textColor="white"
                                            type="submit"
                                        />
                                    </div>
                                </form>
                            ) : (
                                <div className="profile-info">
                                    <div className="info-grid">
                                        <div className="info-item">
                                            <strong>نام:</strong> {profile.name}
                                        </div>
                                        <div className="info-item">
                                            <strong>ایمیل:</strong> {profile.email}
                                        </div>
                                        <div className="info-item">
                                            <strong>شماره تماس:</strong> {profile.phone || 'وارد نشده'}
                                        </div>
                                        <div className="info-item">
                                            <strong>شرکت:</strong> {profile.company_name || 'وارد نشده'}
                                        </div>
                                        <div className="info-item">
                                            <strong>نوع حساب:</strong> {profile.is_dealer ? 'نماینده فروش' : 'مشتری'}
                                        </div>
                                        <div className="info-item">
                                            <strong>عضویت:</strong> {new Date(profile.date_joined).toLocaleDateString('fa-IR')}
                                        </div>
                                        {profile.last_login && (
                                            <div className="info-item">
                                                <strong>آخرین ورود:</strong> {new Date(profile.last_login).toLocaleDateString('fa-IR')}
                                            </div>
                                        )}
                                    </div>

                                    {profile.is_dealer && (
                                        <div className="dealer-info">
                                            <h3>اطلاعات نمایندگی</h3>
                                            <div className="info-grid">
                                                <div className="info-item">
                                                    <strong>کد نماینده:</strong> {profile.dealer_code}
                                                </div>
                                                <div className="info-item">
                                                    <strong>درصد کمیسیون:</strong> {profile.dealer_commission_rate}%
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </NeoBrutalistCard>

                        {/* Statistics */}
                        {profile.statistics && (
                            <NeoBrutalistCard className="stats-card">
                                <h3>آمار حساب کاربری</h3>
                                <div className="stats-grid">
                                    <div className="stat-item">
                                        <span className="stat-value">{profile.statistics.total_orders || 0}</span>
                                        <span className="stat-label">کل سفارشات</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">{profile.statistics.completed_orders || 0}</span>
                                        <span className="stat-label">تکمیل شده</span>
                                    </div>
                                    {profile.statistics.total_spent && (
                                        <div className="stat-item">
                                            <span className="stat-value">{formatPrice(profile.statistics.total_spent)}</span>
                                            <span className="stat-label">کل خرید</span>
                                        </div>
                                    )}
                                    {profile.statistics.total_commission_earned && (
                                        <div className="stat-item">
                                            <span className="stat-value">{formatPrice(profile.statistics.total_commission_earned)}</span>
                                            <span className="stat-label">کمیسیون کسب شده</span>
                                        </div>
                                    )}
                                </div>
                            </NeoBrutalistCard>
                        )}
                    </div>
                )}

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div className="orders-tab">
                        {ordersData ? (
                            <>
                                <NeoBrutalistCard className="orders-summary-card">
                                    <h3>خلاصه سفارشات</h3>
                                    <div className="summary-grid">
                                        <div className="summary-item">
                                            <span className="summary-value">{ordersData.summary.total_orders}</span>
                                            <span className="summary-label">کل سفارشات</span>
                                        </div>
                                        <div className="summary-item">
                                            <span className="summary-value">{ordersData.summary.pending_orders}</span>
                                            <span className="summary-label">در انتظار قیمت‌گذاری</span>
                                        </div>
                                        <div className="summary-item">
                                            <span className="summary-value">{ordersData.summary.waiting_approval}</span>
                                            <span className="summary-label">در انتظار تأیید</span>
                                        </div>
                                        <div className="summary-item">
                                            <span className="summary-value">{ordersData.summary.completed_orders}</span>
                                            <span className="summary-label">تکمیل شده</span>
                                        </div>
                                        {ordersData.summary.total_spent && (
                                            <div className="summary-item">
                                                <span className="summary-value">{formatPrice(ordersData.summary.total_spent)}</span>
                                                <span className="summary-label">کل خرید</span>
                                            </div>
                                        )}
                                    </div>
                                </NeoBrutalistCard>

                                {ordersData.recent_orders.length > 0 && (
                                    <NeoBrutalistCard className="recent-orders-card">
                                        <div className="card-header">
                                            <h3>آخرین سفارشات</h3>
                                            <NeoBrutalistButton
                                                text="مشاهده همه"
                                                color="blue-400"
                                                textColor="white"
                                                onClick={() => navigate('/dashboard')}
                                            />
                                        </div>
                                        <div className="recent-orders-list">
                                            {ordersData.recent_orders.map(order => (
                                                <div key={order.id} className="recent-order-item">
                                                    <div className="order-info">
                                                        <strong>سفارش #{order.id}</strong>
                                                        <span className="order-date">
                                                            {new Date(order.created_at).toLocaleDateString('fa-IR')}
                                                        </span>
                                                    </div>
                                                    <div className="order-status">
                                                        <span className={`status-badge ${order.status}`}>
                                                            {order.status === 'completed' ? 'تکمیل شده' :
                                                                order.status === 'pending_pricing' ? 'در انتظار قیمت' :
                                                                    order.status === 'waiting_customer_approval' ? 'در انتظار تأیید' :
                                                                        'نامشخص'}
                                                        </span>
                                                        <span className="order-total">
                                                            {formatPrice(order.total)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </NeoBrutalistCard>
                                )}
                            </>
                        ) : (
                            <div className="loading-state">در حال بارگیری...</div>
                        )}
                    </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="notifications-tab">
                        {notificationsData ? (
                            <>
                                <NeoBrutalistCard className="notifications-summary-card">
                                    <h3>خلاصه اطلاع‌رسانی‌ها</h3>
                                    <div className="notification-stats">
                                        <div className="stat-item">
                                            <span className="stat-value">{notificationsData.email_notifications.length}</span>
                                            <span className="stat-label">📧 ایمیل</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-value">{notificationsData.sms_notifications.length}</span>
                                            <span className="stat-label">📱 پیامک</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-value">{notificationsData.total_notifications}</span>
                                            <span className="stat-label">کل اطلاع‌رسانی‌ها</span>
                                        </div>
                                    </div>
                                </NeoBrutalistCard>

                                <div className="notifications-lists">
                                    {/* Email Notifications */}
                                    {notificationsData.email_notifications.length > 0 && (
                                        <NeoBrutalistCard className="notifications-list-card">
                                            <h4>📧 اطلاع‌رسانی‌های ایمیل</h4>
                                            <div className="notifications-list">
                                                {notificationsData.email_notifications.slice(0, 10).map(notification => (
                                                    <div key={`email-${notification.id}`} className="notification-item">
                                                        <div className="notification-header">
                                                            <span className="notification-type">
                                                                {getNotificationIcon('email')} {getNotificationTypeText(notification.email_type)}
                                                            </span>
                                                            <span className={`notification-status ${notification.is_successful ? 'success' : 'failed'}`}>
                                                                {notification.is_successful ? '✅' : '❌'}
                                                            </span>
                                                        </div>
                                                        <div className="notification-content">
                                                            <div className="notification-subject">{notification.subject}</div>
                                                            <div className="notification-meta">
                                                                <span>{new Date(notification.sent_at).toLocaleDateString('fa-IR')}</span>
                                                                {notification.order_id && (
                                                                    <span>سفارش #{notification.order_id}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </NeoBrutalistCard>
                                    )}

                                    {/* SMS Notifications */}
                                    {notificationsData.sms_notifications.length > 0 && (
                                        <NeoBrutalistCard className="notifications-list-card">
                                            <h4>📱 اطلاع‌رسانی‌های پیامک</h4>
                                            <div className="notifications-list">
                                                {notificationsData.sms_notifications.slice(0, 10).map(notification => (
                                                    <div key={`sms-${notification.id}`} className="notification-item">
                                                        <div className="notification-header">
                                                            <span className="notification-type">
                                                                {getNotificationIcon('sms')} {getNotificationTypeText(null, notification.sms_type)}
                                                            </span>
                                                            <span className={`notification-status ${notification.is_successful ? 'success' : 'failed'}`}>
                                                                {notification.is_successful ? '✅' : '❌'}
                                                            </span>
                                                        </div>
                                                        <div className="notification-content">
                                                            <div className="notification-message">{notification.message}</div>
                                                            <div className="notification-meta">
                                                                <span>{new Date(notification.sent_at).toLocaleDateString('fa-IR')}</span>
                                                                {notification.order_id && (
                                                                    <span>سفارش #{notification.order_id}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </NeoBrutalistCard>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="loading-state">در حال بارگیری...</div>
                        )}
                    </div>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <div className="security-tab">
                        <NeoBrutalistCard className="security-card">
                            <h3>🔒 تنظیمات امنیتی</h3>
                            <div className="security-actions">
                                <div className="security-item">
                                    <div className="security-info">
                                        <h4>تغییر رمز عبور</h4>
                                        <p>برای حفظ امنیت حساب خود، رمز عبور را به‌طور مرتب تغییر دهید</p>
                                    </div>
                                    <NeoBrutalistButton
                                        text="تغییر رمز عبور"
                                        color="orange-400"
                                        textColor="white"
                                        onClick={() => setShowPasswordModal(true)}
                                    />
                                </div>

                                <div className="security-item">
                                    <div className="security-info">
                                        <h4>آخرین ورود</h4>
                                        <p>
                                            {profile.last_login
                                                ? new Date(profile.last_login).toLocaleDateString('fa-IR')
                                                : 'اطلاعات موجود نیست'
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="security-item">
                                    <div className="security-info">
                                        <h4>خروج از همه دستگاه‌ها</h4>
                                        <p>در صورت مشکوک بودن فعالیت حساب، از همه دستگاه‌ها خارج شوید</p>
                                    </div>
                                    <NeoBrutalistButton
                                        text="خروج از همه"
                                        color="red-400"
                                        textColor="white"
                                        onClick={handleLogout}
                                    />
                                </div>
                            </div>
                        </NeoBrutalistCard>
                    </div>
                )}
            </div>

            {/* Password Change Modal */}
            <NeoBrutalistModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                title="تغییر رمز عبور"
                size="medium"
            >
                <ChangePasswordForm
                    onSuccess={() => {
                        setShowPasswordModal(false);
                        setMessage('رمز عبور با موفقیت تغییر یافت');
                        setTimeout(() => setMessage(''), 3000);
                    }}
                    onError={(error) => setError(error)}
                />
            </NeoBrutalistModal>
        </div>
    );
};

// Change Password Component
const ChangePasswordForm = ({ onSuccess, onError }) => {
    const [formData, setFormData] = useState({
        current_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.new_password !== formData.confirm_password) {
            onError('رمزهای عبور جدید مطابقت ندارند');
            return;
        }

        if (formData.new_password.length < 8) {
            onError('رمز عبور باید حداقل 8 کاراکتر باشد');
            return;
        }

        setLoading(true);
        try {
            await API.post('/profile/change-password/', formData);
            onSuccess();
        } catch (error) {
            console.error('❌ Error changing password:', error);
            if (error.response?.data?.error) {
                onError(error.response.data.error);
            } else {
                onError('خطا در تغییر رمز عبور');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="password-form">
            <div className="form-group">
                <label>رمز عبور فعلی:</label>
                <input
                    type="password"
                    value={formData.current_password}
                    onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                    required
                    className="form-input"
                />
            </div>

            <div className="form-group">
                <label>رمز عبور جدید:</label>
                <input
                    type="password"
                    value={formData.new_password}
                    onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                    required
                    minLength={8}
                    className="form-input"
                />
            </div>

            <div className="form-group">
                <label>تأیید رمز عبور جدید:</label>
                <input
                    type="password"
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                    required
                    minLength={8}
                    className="form-input"
                />
            </div>

            <div className="form-actions">
                <NeoBrutalistButton
                    text={loading ? 'در حال تغییر...' : 'تغییر رمز عبور'}
                    color="green-400"
                    textColor="white"
                    type="submit"
                    disabled={loading}
                />
            </div>
        </form>
    );
};

export default ProfilePage;