import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/api';
import { Loader2, AlertCircle } from 'lucide-react';



const AcceptInvite = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { logout, user, isLoading } = useAuth();

    const [status, setStatus] = useState('checking'); // checking, error
    const [error, setError] = useState('');

    useEffect(() => {
        const init = async () => {
            if (isLoading) return; // Wait for auth check to complete

            if (user) {
                await logout(false); // Silent logout (no redirect)
            }

            if (!token) {
                setStatus('error');
                setError('Invalid invitation link. Token is missing.');
                return;
            }

            try {
                const response = await apiService.auth.getInviteDetails(token);
                const inviteData = response?.data || response || {};

                // Since the user is pre-registered, we can bypass the join page
                // and send them straight to login with their email pre-filled.
                navigate('/login', {
                    replace: true,
                    state: {
                        email: inviteData.email || ''
                    }
                });
            } catch (err) {
                console.error("Error fetching invite details:", err);
                setStatus('error');
                setError(err.response?.data?.message || 'Invalid or expired invitation link.');
            }
        };

        init();
    }, [token, user, isLoading, navigate, logout]);

    if (status === 'checking') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin text-black" />
                    <p className="text-gray-500 font-medium">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full text-center">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="text-red-500" size={24} />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Invitation Error</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

export default AcceptInvite;
