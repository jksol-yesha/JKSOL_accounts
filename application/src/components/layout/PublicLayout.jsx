import React from 'react';
import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
    return (
        <div className="min-h-screen w-full bg-white font-sans text-gray-900">
            <Outlet />
        </div>
    );
};

export default PublicLayout;
