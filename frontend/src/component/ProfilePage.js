// src/component/ProfilePage.js - Enhanced Neo-Brutalist Profile Page
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from './api';
import NeoBrutalistCard from './NeoBrutalist/NeoBrutalistCard';
import NeoBrutalistButton from './NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistInput from './NeoBrutalist/NeoBrutalistInput';
import NeoBrutalistModal from './NeoBrutalist/NeoBrutalistModal';
import '../styles/component/CustomerComponent/profile.css';

const ProfilePage = ({ isModal = false }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('profile');
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
            setProfile(response.data.profile);
            setFormData({
                name: response.data.profile.name,
                phone: response.data.profile.phone || '',
                company_name: response.data.profile.company_name || ''
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
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
            setOrdersData(response.data);
        } catch (error) {
            console.error('Error fetching orders summary:', error);
        }
    };

    const fetchNotifications = async () => {
        try {
            const response = await API.get('/profile/notifications-history/');
            setNotificationsData(response.data);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            const response = await API.put('/profile/update/', formData);
            setProfile({ ...profile, ...response.data.profile });
            setEditing(false);
            setMessage('پروفایل با موفقیت به‌روزرسانی شد');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Error updating profile:', error);
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
            <div className="enhanced-profile-container">
                <NeoBrutalistCard className="profile-loading-card">
                    <div className="profile-loading-content">
                        <div className="profile-loading-spinner">🔄</div>
                        <h2>در حال بارگیری...</h2>
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="enhanced-profile-container">
                <NeoBrutalistCard className="profile-error-card">
                    <div className="profile-error-content">
                        <span className="profile-error-icon">❌</span>
                        <h3>خطا در بارگیری پروفایل</h3>
                        <NeoBrutalistButton
                            text="بازگشت به داشبورد"
                            color="blue-400"
                            textColor="white"
                            onClick={() => navigate('/dashboard')}
                        />
                    </div>
                </NeoBrutalistCard>
            </div>
        );
    }

    return (
        <div className="enhanced-profile-page">
            {/* Header - only show if not in modal */}
            {!isModal && (
                <div className="enhanced-profile-header">
                    <div className="profile-header-content">
                        <div className="profile-title-section">
                            <h1 className="enhanced-profile-title"> پروفایل کاربری</h1>
                            <div className="profile-user-welcome">
                                <span className="profile-welcome-text">خوش آمدید،</span>
                                <span className="profile-user-name">{profile.name}</span>
                            </div>
                        </div>
                        <div className="profile-header-actions">
                            <NeoBrutalistButton
                                text="خروج"
                                color="red-400"
                                textColor="white"
                                onClick={handleLogout}
                                className="profile-logout-btn"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Messages */}
            {message && (
                <div className="profile-status-message profile-success">
                    <span className="profile-status-icon">✅</span>
                    <span>{message}</span>
                    <NeoBrutalistButton
                        text="×"
                        color="white"
                        textColor="black"
                        onClick={() => setMessage('')}
                        className="profile-close-btn"
                    />
                </div>
            )}

            {error && (
                <div className="profile-status-message profile-error">
                    <span className="profile-status-icon">⚠️</span>
                    <span>{error}</span>
                    <NeoBrutalistButton
                        text="×"
                        color="white"
                        textColor="black"
                        onClick={() => setError('')}
                        className="profile-close-btn"
                    />
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="enhanced-profile-navigation">
                <NeoBrutalistButton
                    text="اطلاعات شخصی"
                    color={activeTab === 'profile' ? 'yellow-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('profile')}
                    className="profile-nav-tab"
                />
                <NeoBrutalistButton
                    text="خلاصه سفارشات"
                    color={activeTab === 'orders' ? 'yellow-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('orders')}
                    className="profile-nav-tab"
                />
                <NeoBrutalistButton
                    text="تاریخچه اطلاع‌رسانی"
                    color={activeTab === 'notifications' ? 'yellow-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('notifications')}
                    className="profile-nav-tab"
                />
                <NeoBrutalistButton
                    text="امنیت"
                    color={activeTab === 'security' ? 'yellow-400' : 'gray-400'}
                    textColor="black"
                    onClick={() => setActiveTab('security')}
                    className="profile-nav-tab"
                />
            </div>

            {/* Tab Content */}
            <div className="enhanced-profile-content">
                {/* Profile Information Tab */}
                {activeTab === 'profile' && (
                    <div className="profile-info-tab">
                        {/* Main Profile Card */}
                        <NeoBrutalistCard className="enhanced-profile-info-card">
                            <div className="profile-card-header">
                                <h2 className="profile-card-title"> اطلاعات شخصی</h2>
                                <NeoBrutalistButton
                                    text={editing ? 'لغو' : ' ویرایش'}
                                    color={editing ? 'red-400' : 'blue-400'}
                                    textColor="white"
                                    onClick={() => {
                                        setEditing(!editing);
                                        if (editing) {
                                            setFormData({
                                                name: profile.name,
                                                phone: profile.phone || '',
                                                company_name: profile.company_name || ''
                                            });
                                        }
                                    }}
                                    className="profile-edit-toggle-btn"
                                />
                            </div>

                            {editing ? (
                                <form onSubmit={handleUpdateProfile} className="enhanced-profile-edit-form">
                                    <div className="profile-form-grid">
                                        <div className="profile-form-group">
                                            <label className="profile-form-label">نام:</label>
                                            <NeoBrutalistInput
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="نام و نام خانوادگی"
                                                required
                                            />
                                        </div>

                                        <div className="profile-form-group">
                                            <label className="profile-form-label">شماره تماس:</label>
                                            <NeoBrutalistInput
                                                type="tel"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="09121234567"
                                            />
                                        </div>

                                        <div className="profile-form-group profile-form-full-width">
                                            <label className="profile-form-label">نام شرکت:</label>
                                            <NeoBrutalistInput
                                                type="text"
                                                value={formData.company_name}
                                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                                placeholder="نام شرکت (اختیاری)"
                                            />
                                        </div>
                                    </div>

                                    <div className="profile-form-actions">
                                        <NeoBrutalistButton
                                            text="ذخیره تغییرات"
                                            color="green-400"
                                            textColor="black"
                                            type="submit"
                                            className="profile-save-btn"
                                        />
                                    </div>
                                </form>
                            ) : (
                                <div className="enhanced-profile-display">
                                    <div className="profile-info-grid">
                                        <div className="profile-info-item">
                                            <span className="profile-info-label"> نام:</span>
                                            <span className="profile-info-value">{profile.name}</span>
                                        </div>
                                        <div className="profile-info-item">
                                            <span className="profile-info-label"> ایمیل:</span>
                                            <span className="profile-info-value">{profile.email}</span>
                                        </div>
                                        <div className="profile-info-item">
                                            <span className="profile-info-label"> شماره تماس:</span>
                                            <span className="profile-info-value">{profile.phone || 'وارد نشده'}</span>
                                        </div>
                                        <div className="profile-info-item">
                                            <span className="profile-info-label"> شرکت:</span>
                                            <span className="profile-info-value">{profile.company_name || 'وارد نشده'}</span>
                                        </div>
                                        <div className="profile-info-item">
                                            <span className="profile-info-label"> نوع حساب:</span>
                                            <span className="profile-info-value profile-account-type">
                                                {profile.is_dealer ? ' نماینده فروش' : ' مشتری'}
                                            </span>
                                        </div>
                                        <div className="profile-info-item">
                                            <span className="profile-info-label"> عضویت:</span>
                                            <span className="profile-info-value">{new Date(profile.date_joined).toLocaleDateString('fa-IR')}</span>
                                        </div>
                                        {profile.last_login && (
                                            <div className="profile-info-item">
                                                <span className="profile-info-label"> آخرین ورود:</span>
                                                <span className="profile-info-value">{new Date(profile.last_login).toLocaleDateString('fa-IR')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </NeoBrutalistCard>

                        {/* Dealer Information Card */}
                        {profile.is_dealer && (
                            <NeoBrutalistCard className="enhanced-dealer-info-card">
                                <div className="profile-card-header">
                                    <h3 className="profile-card-title">اطلاعات نمایندگی</h3>
                                </div>
                                <div className="profile-dealer-details">
                                    <div className="profile-dealer-grid">
                                        <div className="profile-dealer-item">
                                            <span className="profile-dealer-label">کد نماینده:</span>
                                            <span className="profile-dealer-value">{profile.dealer_code}</span>
                                        </div>
                                        <div className="profile-dealer-item">
                                            <span className="profile-dealer-label"> درصد کمیسیون:</span>
                                            <span className="profile-dealer-value profile-commission-rate">{profile.dealer_commission_rate}%</span>
                                        </div>
                                    </div>
                                </div>
                            </NeoBrutalistCard>
                        )}

                        {/* Statistics Card */}
                        {profile.statistics && (
                            <NeoBrutalistCard className="enhanced-statistics-card">
                                <div className="profile-card-header">
                                    <h3 className="profile-card-title"> آمار حساب کاربری</h3>
                                </div>
                                <div className="profile-stats-grid">
                                    <div className="profile-stat-item">
                                        <div className="profile-stat-icon">📦</div>
                                        <div className="profile-stat-number">{profile.statistics.total_orders || 0}</div>
                                        <div className="profile-stat-label">کل سفارشات</div>
                                    </div>
                                    <div className="profile-stat-item">
                                        <div className="profile-stat-icon">✅</div>
                                        <div className="profile-stat-number">{profile.statistics.completed_orders || 0}</div>
                                        <div className="profile-stat-label">تکمیل شده</div>
                                    </div>
                                    {profile.statistics.total_spent && (
                                        <div className="profile-stat-item">
                                            <div className="profile-stat-icon"></div>
                                            <div className="profile-stat-number">{formatPrice(profile.statistics.total_spent)}</div>
                                            <div className="profile-stat-label">کل خرید</div>
                                        </div>
                                    )}
                                    {profile.statistics.total_commission_earned && (
                                        <div className="profile-stat-item">
                                            <div className="profile-stat-icon">💰</div>
                                            <div className="profile-stat-number">{formatPrice(profile.statistics.total_commission_earned)}</div>
                                            <div className="profile-stat-label">کمیسیون کسب شده</div>
                                        </div>
                                    )}
                                </div>
                            </NeoBrutalistCard>
                        )}
                    </div>
                )}

                {/* Orders Summary Tab */}
                {activeTab === 'orders' && (
                    <div className="profile-orders-tab">
                        {ordersData ? (
                            <>
                                <NeoBrutalistCard className="enhanced-orders-summary-card">
                                    <div className="profile-card-header">
                                        <h3 className="profile-card-title">خلاصه سفارشات</h3>
                                        <NeoBrutalistButton
                                            text="مشاهده همه"
                                            color="blue-400"
                                            textColor="white"
                                            onClick={() => navigate('/dashboard')}
                                            className="profile-view-all-btn"
                                        />
                                    </div>
                                    <div className="profile-orders-summary-grid">
                                        <div className="profile-summary-item profile-summary-total">
                                            <div className="profile-summary-icon">📦</div>
                                            <div className="profile-summary-number">{ordersData.summary.total_orders}</div>
                                            <div className="profile-summary-label">کل سفارشات</div>
                                        </div>
                                        <div className="profile-summary-item profile-summary-pending">
                                            <div className="profile-summary-icon">⏳</div>
                                            <div className="profile-summary-number">{ordersData.summary.pending_orders}</div>
                                            <div className="profile-summary-label">در انتظار قیمت‌گذاری</div>
                                        </div>
                                        <div className="profile-summary-item profile-summary-waiting">
                                            <div className="profile-summary-icon">⌛</div>
                                            <div className="profile-summary-number">{ordersData.summary.waiting_approval}</div>
                                            <div className="profile-summary-label">در انتظار تأیید</div>
                                        </div>
                                        <div className="profile-summary-item profile-summary-completed">
                                            <div className="profile-summary-icon">✅</div>
                                            <div className="profile-summary-number">{ordersData.summary.completed_orders}</div>
                                            <div className="profile-summary-label">تکمیل شده</div>
                                        </div>
                                        {ordersData.summary.total_spent && (
                                            <div className="profile-summary-item profile-summary-total-spent">

                                                <div className="profile-summary-amount">{formatPrice(ordersData.summary.total_spent)}</div>
                                                <div className="profile-summary-label">کل خرید</div>
                                            </div>
                                        )}
                                    </div>
                                </NeoBrutalistCard>

                                {ordersData.recent_orders.length > 0 && (
                                    <NeoBrutalistCard className="enhanced-recent-orders-card">
                                        <div className="profile-card-header">
                                            <h3 className="profile-card-title">آخرین سفارشات</h3>
                                        </div>
                                        <div className="profile-recent-orders-list">
                                            {ordersData.recent_orders.map(order => (
                                                <div key={order.id} className="profile-recent-order-item">
                                                    <div className="profile-order-info">
                                                        <div className="profile-order-header">
                                                            <strong className="profile-order-id">سفارش #{order.id}</strong>
                                                            <span className={`profile-order-status profile-order-status-${order.status.replace(/_/g, '-')}`}>
                                                                {order.status === 'completed' ? '✅ تکمیل شده' :
                                                                    order.status === 'pending_pricing' ? '⏳ در انتظار قیمت' :
                                                                        order.status === 'waiting_customer_approval' ? '⌛ در انتظار تأیید' :
                                                                            'نامشخص'}
                                                            </span>
                                                        </div>
                                                        <div className="profile-order-details">
                                                            <span className="profile-order-date">
                                                                 {new Date(order.created_at).toLocaleDateString('fa-IR')}
                                                            </span>
                                                            <span className="profile-order-total">
                                                                💰 {formatPrice(order.total)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </NeoBrutalistCard>
                                )}
                            </>
                        ) : (
                            <NeoBrutalistCard className="profile-loading-card">
                                <div className="profile-loading-content">
                                    <div className="profile-loading-spinner">🔄</div>
                                    <span>در حال بارگیری...</span>
                                </div>
                            </NeoBrutalistCard>
                        )}
                    </div>
                )}

                {/* Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="profile-notifications-tab">
                        {notificationsData ? (
                            <>
                                <NeoBrutalistCard className="enhanced-notifications-summary-card">
                                    <div className="profile-card-header">
                                        <h3 className="profile-card-title">🔔 خلاصه اطلاع‌رسانی‌ها</h3>
                                    </div>
                                    <div className="profile-notifications-stats">
                                        <div className="profile-notification-stat">
                                            <div className="profile-stat-label">ایمیل</div>
                                            <div className="profile-stat-number">📧&nbsp;&nbsp;&nbsp;&nbsp;{notificationsData.email_notifications.length}</div>

                                        </div>
                                        <div className="profile-notification-stat">
                                            <div className="profile-stat-label">پیامک</div>
                                            <div className="profile-stat-number">📱&nbsp;&nbsp;&nbsp;&nbsp;{notificationsData.sms_notifications.length}</div>
                                        </div>
                                        <div className="profile-notification-stat profile-notification-stat-total">
                                            <div className="profile-stat-label">کل اطلاع‌رسانی‌ها</div>
                                            <div className="profile-stat-number">🔔&nbsp;&nbsp;&nbsp;&nbsp;{notificationsData.total_notifications}</div>
                                        </div>
                                    </div>
                                </NeoBrutalistCard>

                                <div className="profile-notifications-lists">
                                    {/* Email Notifications */}
                                    {notificationsData.email_notifications.length > 0 && (
                                        <NeoBrutalistCard className="enhanced-notifications-list-card">
                                            <div className="profile-card-header">
                                                <h4 className="profile-card-title"> اطلاع‌رسانی‌های ایمیل</h4>
                                            </div>
                                            <div className="profile-notifications-list">
                                                {notificationsData.email_notifications.slice(0, 10).map(notification => (
                                                    <div key={`email-${notification.id}`} className="profile-notification-item">
                                                        <div className="profile-notification-header">
                                                            <span className="profile-notification-type">
                                                                {getNotificationIcon('email')} {getNotificationTypeText(notification.email_type)}
                                                            </span>
                                                            <span className={`profile-notification-status ${notification.is_successful ? 'profile-notification-success' : 'profile-notification-failed'}`}>
                                                                {notification.is_successful ? '✅' : '❌'}
                                                            </span>
                                                        </div>
                                                        <div className="profile-notification-content">
                                                            <div className="profile-notification-subject">{notification.subject}</div>
                                                            <div className="profile-notification-meta">
                                                                <span>تاریخ: {new Date(notification.sent_at).toLocaleDateString('fa-IR')}</span>
                                                                {notification.order_id && (
                                                                    <span> سفارش #{notification.order_id}</span>
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
                                        <NeoBrutalistCard className="enhanced-notifications-list-card">
                                            <div className="profile-card-header">
                                                <h4 className="profile-card-title"> اطلاع‌رسانی‌های پیامک</h4>
                                            </div>
                                            <div className="profile-notifications-list">
                                                {notificationsData.sms_notifications.slice(0, 10).map(notification => (
                                                    <div key={`sms-${notification.id}`} className="profile-notification-item">
                                                        <div className="profile-notification-header">
                                                            <span className="profile-notification-type">
                                                                {getNotificationIcon('sms')} {getNotificationTypeText(null, notification.sms_type)}
                                                            </span>
                                                            <span className={`profile-notification-status ${notification.is_successful ? 'profile-notification-success' : 'profile-notification-failed'}`}>
                                                                {notification.is_successful ? '✅' : '❌'}
                                                            </span>
                                                        </div>
                                                        <div className="profile-notification-content">
                                                            <div className="profile-notification-message">{notification.message}</div>
                                                            <div className="profile-notification-meta">
                                                                <span>تاریخ: {new Date(notification.sent_at).toLocaleDateString('fa-IR')}</span>
                                                                {notification.order_id && (
                                                                    <span> سفارش #{notification.order_id}</span>
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
                            <NeoBrutalistCard className="profile-loading-card">
                                <div className="profile-loading-content">
                                    <div className="profile-loading-spinner">🔄</div>
                                    <span>در حال بارگیری...</span>
                                </div>
                            </NeoBrutalistCard>
                        )}
                    </div>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <div className="profile-security-tab">
                        <NeoBrutalistCard className="enhanced-security-card">
                            <div className="profile-card-header">
                                <h3 className="profile-card-title"> تنظیمات امنیتی</h3>
                            </div>
                            <div className="profile-security-actions">
                                <div className="profile-security-item">
                                    <div className="profile-security-icon"></div>
                                    <div className="profile-security-info">
                                        <h4>تغییر رمز عبور</h4>
                                        <p>برای حفظ امنیت حساب خود، رمز عبور را به‌طور مرتب تغییر دهید.</p>
                                    </div>
                                    <NeoBrutalistButton
                                        text="تغییر رمز عبور"
                                        color="orange-400"
                                        textColor="black"
                                        onClick={() => setShowPasswordModal(true)}
                                        className="profile-security-btn"
                                    />
                                </div>

                                <div className="profile-security-item">
                                    <div className="profile-security-icon"></div>
                                    <div className="profile-security-info">
                                        <h4>آخرین ورود</h4>
                                        <p>
                                            {profile.last_login
                                                ? `آخرین فعالیت شما در تاریخ ${new Date(profile.last_login).toLocaleDateString('fa-IR')} ثبت شده است.`
                                                : 'اطلاعاتی در مورد آخرین ورود شما وجود ندارد.'
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="profile-security-item">
                                    <div className="profile-security-icon"></div>
                                    <div className="profile-security-info">
                                        <h4>خروج از همه دستگاه‌ها</h4>
                                        <p>اگر فعالیت مشکوکی در حساب خود مشاهده کردید، می‌توانید از تمام دستگاه‌های دیگر خارج شوید.</p>
                                    </div>
                                    <NeoBrutalistButton
                                        text="خروج از همه"
                                        color="red-400"
                                        textColor="white"
                                        onClick={handleLogout}
                                        className="profile-security-btn"
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
                title=" تغییر رمز عبور"
                size="medium"
            >
                <ChangePasswordForm
                    onSuccess={() => {
                        setShowPasswordModal(false);
                        setMessage('رمز عبور با موفقیت تغییر یافت.');
                        setTimeout(() => setMessage(''), 3000);
                    }}
                    onError={(err) => {
                        setError(err);
                        setTimeout(() => setError(''), 5000);
                    }}
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
        onError(''); // Clear previous errors

        if (formData.new_password !== formData.confirm_password) {
            onError('رمزهای عبور جدید با یکدیگر مطابقت ندارند.');
            return;
        }

        if (formData.new_password.length < 8) {
            onError('رمز عبور جدید باید حداقل 8 کاراکتر باشد.');
            return;
        }

        setLoading(true);
        try {
            await API.post('/profile/change-password/', {
                current_password: formData.current_password,
                new_password: formData.new_password,
            });
            onSuccess();
            setFormData({ current_password: '', new_password: '', confirm_password: '' });
        } catch (error) {
            console.error('Error changing password:', error);
            const errorMsg = error.response?.data?.error || 'خطایی در هنگام تغییر رمز عبور رخ داد. لطفاً رمز عبور فعلی خود را بررسی کنید.';
            onError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="change-password-form-container">
            <form onSubmit={handleSubmit} className="change-password-form">
                <div className="profile-form-group">
                    <label className="profile-form-label">رمز عبور فعلی:</label>
                    <NeoBrutalistInput
                        type="password"
                        value={formData.current_password}
                        onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                        placeholder="رمز عبور فعلی را وارد کنید"
                        required
                    />
                </div>

                <div className="profile-form-group">
                    <label className="profile-form-label">رمز عبور جدید:</label>
                    <NeoBrutalistInput
                        type="password"
                        value={formData.new_password}
                        onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                        placeholder="رمز عبور جدید (حداقل 8 کاراکتر)"
                        required
                        minLength={8}
                    />
                </div>

                <div className="profile-form-group">
                    <label className="profile-form-label">تأیید رمز عبور جدید:</label>
                    <NeoBrutalistInput
                        type="password"
                        value={formData.confirm_password}
                        onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                        placeholder="رمز عبور جدید را مجدداً وارد کنید"
                        required
                        minLength={8}
                    />
                </div>

                <div className="profile-form-actions">
                    <NeoBrutalistButton
                        text={loading ? 'در حال تغییر...' : ' تغییر رمز عبور'}
                        color="green-400"
                        textColor="black"
                        type="submit"
                        disabled={loading}
                        className="profile-save-btn"
                    />
                </div>
            </form>
        </div>
    );
};

export default ProfilePage;