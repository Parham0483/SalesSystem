
import React from 'react';
import { Navigate } from 'react-router-dom';

const AdminRoute = ({ children }) => {
    const userDataString = localStorage.getItem('userData');
    const user = userDataString ? JSON.parse(userDataString) : null;

    if (!user || !user.is_staff) {
        // Not logged in or not admin then redirect to login
        return <Navigate to="/login" replace />;
    }

    // Authorized → render the child page
    return children;
};

export default AdminRoute;
