
import React from 'react';
import { Navigate } from 'react-router-dom';

const AdminRoute = ({ children }) => {
    const userDataString = localStorage.getItem('userData');
    const user = userDataString ? JSON.parse(userDataString) : null;

    if (!user || !user.is_staff) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default AdminRoute;
