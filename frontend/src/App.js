import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import OrderDetailPage from './component/OrderDetailPage';
import CreateOrderPage from './component/CreateOrderPage';
import { useEffect } from 'react';
import axios from 'axios';
import MainPage from "./pages/MainPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminOrderDetailPage from "./component/AdminOrderDetailPage";
import AdminRoute from "./component/AdminRoute";

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
                <Route path="/" element={<MainPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route
                    path="/admin"
                    element={
                        <AdminRoute>
                            <AdminDashboardPage />
                        </AdminRoute>
                    }
                />
                <Route
                    path="/admin/orders/:orderId"
                    element={
                        <AdminRoute>
                            <AdminOrderDetailPage />
                        </AdminRoute>
                    }
                />

                <Route path="/orders/create" element={<CreateOrderPage />} />
                <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                <Route path="*" element={<div>Page not found</div>} />
            </Routes>
        </Router>
    );
}

export default App;