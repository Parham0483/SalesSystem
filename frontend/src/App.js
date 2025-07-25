// frontend/src/App.js - Corrected routing order for dealer pages

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import OrderDetailPage from './component/OrderDetailPage';
import CreateOrderPage from './component/CreateOrderPage';
import { useEffect } from 'react';
import axios from 'axios';
import MainPage from "./pages/MainPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminOrderDetailPage from "./component/AdminOrderDetailPage";
import AdminRoute from "./component/AdminRoute";
import DealerDashboard from "./pages/DealerDashboard";
import DealerRoute from "./component/DealerRoute";
import ProductsPage from "./pages/ProductsPage";
import NewArrivalsPage from "./pages/NewArrivalsPage";
import AdminOrdersPage  from "./pages/admin/AdminOrdersPage";
import AdminAnnouncementsPage from "./pages/admin/AdminAnnouncementsPage";
import AdminProductPage from "./pages/admin/AdminProductPage";
import AdminCustomersPage from "./pages/admin/AdminCustomerPage";
import AdminDealersPage from "./pages/admin/AdminDealersPage";


const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/';

function App() {
    useEffect(() => {
        console.log('🚀 App initialization...');

        // Get CSRF token
        axios.get(`${API_URL}csrf/`, { withCredentials: true })
            .then(() => {
                console.log('✅ CSRF token obtained');
            })
            .catch(err => console.error('❌ CSRF fetch failed:', err));

        // Initialize authentication
        const initializeAuth = () => {
            const access_token = localStorage.getItem('access_token');
            const refresh_token = localStorage.getItem('refresh_token');
            const userData = localStorage.getItem('userData');

            console.log('🔍 App - Auth initialization:', {
                hasAccessToken: !!access_token,
                hasRefreshToken: !!refresh_token,
                hasUserData: !!userData,
                accessToken: access_token ? `${access_token.substring(0, 20)}...` : null
            });

            if (access_token && refresh_token && userData) {
                // Set the authorization header for all future requests
                axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                console.log('✅ Authorization header set for existing session');

                // Verify token is still valid
                axios.post(`${API_URL}auth/token/verify/`, { token: access_token })
                    .then(() => {
                        console.log('✅ Existing token is valid');
                    })
                    .catch((error) => {
                        console.log('❌ Existing token is invalid:', error.response?.data);
                        // Token is invalid, clear everything
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        localStorage.removeItem('userData');
                        delete axios.defaults.headers.common['Authorization'];
                    });
            } else {
                console.log('ℹ️ No existing authentication found');
                // Ensure no stale headers
                delete axios.defaults.headers.common['Authorization'];
            }
        };

        initializeAuth();
    }, []);

    return (
        <Router>
            <Routes>
                {/* PUBLIC ROUTES */}
                <Route path="/" element={<MainPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* ADMIN ROUTES - Put these BEFORE general routes */}
                <Route path="/admin" element={
                    <AdminRoute><AdminDashboardPage /></AdminRoute>
                } />

                {/* The dedicated page for managing all orders */}
                <Route path="/admin/orders" element={
                    <AdminRoute><AdminOrdersPage /></AdminRoute>
                } />

                {/* You already have this for viewing a single order, maybe as a direct link */}
                <Route path="/admin/orders/:orderId" element={
                    <AdminRoute><AdminOrderDetailPage /></AdminRoute>
                } />

                <Route path="/admin/products" element={
                    <AdminRoute><AdminProductPage /></AdminRoute>
                } />
                <Route path="/admin/announcements" element={
                    <AdminRoute><AdminAnnouncementsPage /></AdminRoute>
                } />
                <Route path="/admin/customers" element={<AdminRoute><AdminCustomersPage /></AdminRoute>} />
                <Route path="/admin/dealers" element={<AdminRoute><AdminDealersPage /></AdminRoute>} />
                <Route path="/admin/reports" element={
                    <AdminRoute><div>Reports Page (To be built)</div></AdminRoute>
                } />

                {/*<Route
                    path="/admin/products/:productId"
                    element={
                    <AdminRoute>
                        <AdminProductManagment/>
                    </AdminRoute>
                    }
                 />
                 */}

                {/* DEALER ROUTES - Put these BEFORE customer routes */}
                <Route
                    path="/dealer"
                    element={
                        <DealerRoute>
                            <DealerDashboard />
                        </DealerRoute>
                    }
                />

                {/* CUSTOMER ROUTES - Put these AFTER specific routes */}
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/orders/create" element={<CreateOrderPage />} />
                <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                <Route path="/product" element={<ProductsPage/>} />
                <Route path="/product/newarrivals" element={<NewArrivalsPage />} />


                {/* CATCH-ALL */}
                <Route path="*" element={<div>Page not found</div>} />
            </Routes>
        </Router>
    );
}

export default App;