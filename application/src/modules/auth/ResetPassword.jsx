import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Loader } from '../../components/common/Loader';
import { isRequired } from '../../utils/validation';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { resetPassword } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!token) {
            setError('Invalid or missing reset token.');
            return;
        }

        if (!isRequired(password) || !isRequired(confirmPassword)) {
            setError('Both fields are required.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);
        try {
            await resetPassword(token, password);
            setSuccess('Password reset successfully. Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            console.error("Reset Password Error:", err);
            setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Reset Password" subtitle="Enter your new password below.">
            <form onSubmit={handleSubmit} className="w-full" noValidate>
                {error && <div className="mb-4 text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}
                {success && <div className="mb-4 text-green-500 text-sm text-center bg-green-50 p-2 rounded">{success}</div>}

                <div className="mb-3">
                    <label className="block text-sm font-bold text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-1.5 rounded border border-gray-300 bg-[#f1f3f9] focus:outline-none focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent transition-all pr-10"
                            placeholder="Enter new password"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 focus:outline-none">
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Confirm New Password</label>
                    <div className="relative">
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-1.5 rounded border border-gray-300 bg-[#f1f3f9] focus:outline-none focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent transition-all pr-10"
                            placeholder="Confirm new password"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 focus:outline-none">
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-black text-white font-bold py-2 rounded hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2"
                >
                    {loading && <Loader className="h-4 w-4 text-white" />}
                    <Lock size={18} className="text-white" />
                    <span>Reset Password</span>
                </button>

                <div className="mt-4 text-center">
                    <Link to="/login" className="text-gray-600 text-sm hover:text-black">Back to Login</Link>
                </div>
            </form>
        </AuthLayout>
    );
};

export default ResetPassword;
