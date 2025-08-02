
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../component/api';
import NeoBrutalistButton from '../../component/NeoBrutalist/NeoBrutalistButton';
import NeoBrutalistCard from '../../component/NeoBrutalist/NeoBrutalistCard';
import '../../styles/Admin/AdminDashboard.css'

const AdminDashboardPage = () => {
    const [stats, setStats] = useState({
        orders: { total: 0, pending: 0, completed: 0 },
        products: { total: 0, active: 0, low_stock: 0, out_of_stock: 0 },
        announcements: { total: 0, recent: 0 }
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            // Fetch dashboard statistics
            const [ordersRes, productsRes, announcementsRes] = await Promise.all([
                API.get('/admin/dashboard/stats/orders/'),
                API.get('/admin/dashboard/stats/products/'),
                API.get('/admin/dashboard/stats/announcements/')
            ]);

            setStats({
                orders: ordersRes.data,
                products: productsRes.data,
                announcements: announcementsRes.data
            });

            // Fetch recent activity
            const activityRes = await API.get('/admin/dashboard/recent-activity/'); // Corrected URL
            setRecentActivity(activityRes.data);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userData');
        delete API.defaults.headers.common['Authorization'];
        navigate('/');
    };

    if (loading) {
        return (
            <div className="admin-dashboard">
                <div className="loading-state">در حال بارگیری...</div>
            </div>
        );
    }

    return (
        <div className="admin-dashboard" dir="rtl">
            {/* Header */}
            <div className="dashboard-header">
                <div className="header-content">
                    <div className="title-section">
                        <h1 className="dashboard-title">پنل مدیریت</h1>
                        <p className="dashboard-subtitle">مدیریت جامع فروشگاه</p>
                    </div>
                    <div className="header-actions">

                        <NeoBrutalistButton
                            text="پروفایل"
                            color="purple-400"
                            textColor="white"
                            onClick={() => navigate('/profile')}
                            className="profile-btn"
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
            </div>

            {/* Quick Stats */}
            <div className="stats-section">
                <div className="stats-grid">
                    <NeoBrutalistCard className="stat-card orders">
                        <div className="stat-header">
                            <h3>📋 سفارشات</h3>
                            <span className="stat-number">{stats.orders.total}</span>
                        </div>
                        <div className="stat-details">
                            <div className="stat-item">
                                <span>در انتظار: {stats.orders.pending}</span>
                            </div>
                            <div className="stat-item">
                                <span>تکمیل شده: {stats.orders.completed}</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card products">
                        <div className="stat-header">
                            <h3>📦 محصولات</h3>
                            <span className="stat-number">{stats.products.total}</span>
                        </div>
                        <div className="stat-details">
                            <div className="stat-item">
                                <span>فعال: {stats.products.active}</span>
                            </div>
                            <div className="stat-item">
                                <span>موجودی کم: {stats.products.low_stock}</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>

                    <NeoBrutalistCard className="stat-card announcements">
                        <div className="stat-header">
                            <h3>📢 اطلاعیه‌ها</h3>
                            <span className="stat-number">{stats.announcements.total}</span>
                        </div>
                        <div className="stat-details">
                            <div className="stat-item">
                                <span>این ماه: {stats.announcements.recent}</span>
                            </div>
                        </div>
                    </NeoBrutalistCard>
                </div>
            </div>

            {/* Main Navigation Cards */}
            <div className="main-actions-section">
                <h2 className="section-title">عملیات اصلی</h2>
                <div className="actions-grid">
                    {/* Orders Management */}
                    <NeoBrutalistCard className="action-card orders-card" onClick={() => navigate('/admin/orders')}>
                        <div className="card-icon">📋</div>
                        <div className="card-content">
                            <h3>مدیریت سفارشات</h3>
                            <p>مشاهده، پردازش و مدیریت سفارشات مشتریان</p>
                            <ul className="card-features">
                                <li>- فیلتر بر اساس وضعیت</li>
                                <li>- جستجو در مشتریان</li>
                                <li>- تخصیص نماینده</li>
                                <li>- قیمت‌گذاری و تکمیل</li>
                            </ul>
                        </div>
                        <NeoBrutalistButton
                            text="ورود به بخش سفارشات"
                            color="yellow-400"
                            textColor="black"
                            className="card-action-btn"
                        />
                    </NeoBrutalistCard>

                    {/* Products Management */}
                    <NeoBrutalistCard className="action-card products-card" onClick={() => navigate('/admin/products')}>
                        <div className="card-icon">📦</div>
                        <div className="card-content">
                            <h3>مدیریت محصولات</h3>
                            <p>افزودن، ویرایش و مدیریت کاتالوگ محصولات</p>
                            <ul className="card-features">
                                <li>- افزودن محصول جدید</li>
                                <li>- ویرایش قیمت و موجودی</li>
                                <li>- مدیریت دسته‌بندی‌ها</li>
                                <li>- آپلود تصاویر</li>
                            </ul>
                        </div>
                        <NeoBrutalistButton
                            text="مدیریت محصولات"
                            color="green-400"
                            textColor="black"
                            className="card-action-btn"
                        />
                    </NeoBrutalistCard>

                    {/* Shipment Announcements */}
                    <NeoBrutalistCard className="action-card announcements-card" onClick={() => navigate('/admin/announcements')}>
                        <div className="card-icon">🚢</div>
                        <div className="card-content">
                            <h3>اطلاعیه محموله‌ها</h3>
                            <p>اعلام ورود محموله‌های جدید به مشتریان</p>
                            <ul className="card-features">
                                <li>- ثبت محموله جدید</li>
                                <li>- آپلود تصاویر متعدد</li>
                                <li>- اطلاع‌رسانی به مشتریان</li>
                                <li>- لینک به محصولات</li>
                            </ul>
                        </div>
                        <NeoBrutalistButton
                            text="مدیریت اطلاعیه‌ها"
                            color="blue-400"
                            textColor="white"
                            className="card-action-btn"
                        />
                    </NeoBrutalistCard>

                    {/* Customers Management */}
                    <NeoBrutalistCard className="action-card customers-card" onClick={() => navigate('/admin/customers')}>
                        <div className="card-icon">👥</div>
                        <div className="card-content">
                            <h3>مدیریت مشتریان</h3>
                            <p>مشاهده و مدیریت اطلاعات مشتریان</p>
                            <ul className="card-features">
                                <li>- لیست تمام مشتریان</li>
                                <li>- تاریخچه سفارشات</li>
                                <li>- اطلاعات تماس</li>
                                <li>- آمار خرید</li>
                            </ul>
                        </div>
                        <NeoBrutalistButton
                            text="مشاهده مشتریان"
                            color="purple-400"
                            textColor="white"
                            className="card-action-btn"
                        />
                    </NeoBrutalistCard>

                    {/* Dealers Management */}
                    <NeoBrutalistCard className="action-card dealers-card" onClick={() => navigate('/admin/dealers')}>
                        <div className="card-icon">🤝</div>
                        <div className="card-content">
                            <h3>مدیریت نمایندگان</h3>
                            <p>مدیریت نمایندگان فروش و کمیسیون‌ها</p>
                            <ul className="card-features">
                                <li>- افزودن نماینده جدید</li>
                                <li>- تنظیم نرخ کمیسیون</li>
                                <li>- گزارش فروش</li>
                                <li>- مدیریت تخصیص‌ها</li>
                            </ul>
                        </div>
                        <NeoBrutalistButton
                            text="مدیریت نمایندگان"
                            color="orange-400"
                            textColor="black"
                            className="card-action-btn"
                        />
                    </NeoBrutalistCard>
                </div>
            </div>


            {/* Recent Activity */}
            <div className="recent-activity-section">
                <h2 className="section-title">فعالیت‌های اخیر</h2>
                <NeoBrutalistCard className="activity-card">
                    <div className="activity-list">
                        {recentActivity.length > 0 ? (
                            recentActivity.slice(0, 10).map((activity, index) => (
                                <div key={index} className="activity-item">
                                    <div className="activity-icon">{activity.icon}</div>
                                    <div className="activity-content">
                                        <span className="activity-text">{activity.description}</span>
                                        <span className="activity-time">{activity.time_ago}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="no-activity">
                                <span>📝 هیچ فعالیت اخیری ثبت نشده</span>
                            </div>
                        )}
                    </div>
                    <div className="activity-footer">
                        <NeoBrutalistButton
                            text="مشاهده تمام فعالیت‌ها"
                            color="gray-400"
                            textColor="black"
                            onClick={() => navigate('/admin/activity-log')}
                            className="view-all-activity-btn"
                        />
                    </div>
                </NeoBrutalistCard>
            </div>
        </div>
    );
};

export default AdminDashboardPage;