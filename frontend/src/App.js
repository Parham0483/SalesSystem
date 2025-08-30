// frontend/src/App.js - Corrected routing order for dealer pages

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/Main/LoginPage';
import RegisterPage from './pages/Main/RegisterPage';
import DashboardPage from './pages/Customer/DashboardPage';
import OrderDetailPage from './component/OrderDetailPage';
import CreateOrderPage from './component/CreateOrderPage';
import { useEffect } from 'react';
import axios from 'axios';
import MainPage from "./pages/Main/MainPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminOrderDetailPage from "./pages/admin/component/AdminOrderDetailPage";
import AdminRoute from "./pages/admin/component/AdminRoute";
import DealerDashboard from "./pages/Dealer/DealerDashboard";
import DealerRoute from "./component/DealerRoute";
import ProductsPage from "./pages/Customer/ProductsPage";
import NewArrivalsPage from "./pages/Customer/NewArrivalsPage";
import AdminOrdersPage  from "./pages/admin/AdminOrdersPage";
import AdminAnnouncementsPage from "./pages/admin/AdminAnnouncementsPage";
import AdminProductPage from "./pages/admin/AdminProductPage";
import AdminCustomersPage from "./pages/admin/AdminCustomerPage";
import AdminDealersPage from "./pages/admin/AdminDealersPage";
import Profile from "./component/ProfilePage";
import CompleteProfilePage from "./pages/Main/CompleteProfilePage";
import GoogleAuthProvider from "./component/GoogleAuth/GoogleOAuthProvider";
import LandingPage from "./pages/Main/LandingPage";


const API_URL = process.env.REACT_APP_API_URL;

function App() {
    useEffect(() => {

        // Get CSRF token
        axios.get(`${API_URL}csrf/`, { withCredentials: true })
            .then(() => {
            })
            .catch(err => console.error(' CSRF fetch failed:', err));

        // Initialize authentication
        const initializeAuth = () => {
            const access_token = localStorage.getItem('access_token');
            const refresh_token = localStorage.getItem('refresh_token');
            const userData = localStorage.getItem('userData');


            if (access_token && refresh_token && userData) {
                // Set the authorization header for all future requests
                axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

                // Verify token is still valid
                axios.post(`${API_URL}auth/token/verify/`, { token: access_token })
                    .then(() => {
                    })
                    .catch((error) => {
                        // Token is invalid, clear everything
                        localStorage.removeItem('access_token');
                        localStorage.removeItem('refresh_token');
                        localStorage.removeItem('userData');
                        delete axios.defaults.headers.common['Authorization'];
                    });
            } else {
                // Ensure no stale headers
                delete axios.defaults.headers.common['Authorization'];
            }
        };

        initializeAuth();
    }, []);

    return (
        <GoogleAuthProvider>
        <Router>
            <Routes>
                {/* PUBLIC ROUTES */}
                {/*<Route path="/" element={<LandingPage />} />*/}
                <Route path="/" element={<MainPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/complete-profile" element={<CompleteProfilePage />} />
                <Route path="/profile" element={<Profile />} />

                {/* ADMIN ROUTES - Put these BEFORE general routes */}
                <Route path="/admin" element={
                    <AdminRoute><AdminDashboardPage /></AdminRoute>
                } />

                {/* The dedicated page for managing all orders */}
                <Route path="/admin/orders" element={
                    <AdminRoute><AdminOrdersPage /></AdminRoute>
                } />

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

                {/* DEALER ROUTES*/}
                <Route
                    path="/dealer"
                    element={
                        <DealerRoute>
                            <DealerDashboard />
                        </DealerRoute>
                    }
                />

                {/* CUSTOMER ROUTES*/}
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/orders/create" element={<CreateOrderPage />} />
                <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                <Route path="/product" element={<ProductsPage/>} />
                <Route path="/product/newarrivals" element={<NewArrivalsPage />} />


                {/* CATCH-ALL */}
                <Route path="*" element={<div>Page not found</div>} />
            </Routes>
        </Router>
            </GoogleAuthProvider>
    );
}

export default App;