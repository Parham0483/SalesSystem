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

const API_URL = process.env.REACT_APP_API_URL;

function App() {
  useEffect(() => {
    axios.get(`${API_URL}csrf/`, { withCredentials: true })
      .catch(err => console.error('CSRF fetch failed:', err));


    const access_token = localStorage.getItem('access_token');
    if (access_token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    }
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
