import React from 'react';
import { Navigate } from 'react-router-dom';

const DealerRoute = ({ children }) => {
    const userDataString = localStorage.getItem('userData');
    const user = userDataString ? JSON.parse(userDataString) : null;

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!user.is_dealer && !user.is_staff) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default DealerRoute;