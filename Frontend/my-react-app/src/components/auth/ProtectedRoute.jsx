import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
    const context = useAuth();
    if (!context) {
        console.error("AuthContext is missing! Make sure AuthProvider wraps the app.");
        return <div className="p-4 text-red-500">Error: Auth Context Missing</div>;
    }
    const { user, isLoading } = context;

    if (isLoading) {
        return null;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
