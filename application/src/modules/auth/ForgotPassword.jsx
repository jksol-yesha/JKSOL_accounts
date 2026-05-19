import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { Lock } from 'lucide-react';
import { Loader } from '../../components/common/Loader';
import { useFormNavigation } from '../../hooks/useFormNavigation';
import { useAuth } from '../../context/AuthContext';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { forgotPassword } = useAuth();

    const emailRef = useRef(null);
    const inputs = [emailRef];

    const handleSubmit = async () => {
        if (!email) {
            setError('Please enter your email address');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            await forgotPassword(email);
            setMessage('If an account exists with this email, you will receive a password reset link shortly.');
            setEmail('');
        } catch (err) {
            console.error(err);
            // Ideally don't reveal if user exists or not for security, but backend might throw error
            // Current backend forgotPassword throws "User not found"
            // We should probably normalize this in UI to generic message or show error if strictly dev mode
            // For now, let's show generic success message or specific error if critical
            setError(err.response?.data?.message || 'Failed to process request. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = useFormNavigation(inputs, handleSubmit);

    return (
        <AuthLayout title="Reset Password" subtitle="Enter your email address and we'll send you a link to reset your password.">
            <form className="w-full" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                {message && <div className="mb-4 bg-green-50 text-green-600 text-sm p-3 rounded text-center">{message}</div>}
                {error && <div className="mb-4 bg-red-50 text-red-500 text-sm p-3 rounded text-center">{error}</div>}

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                    <input
                        ref={emailRef}
                        onKeyDown={(e) => handleKeyDown(e, 0)}
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            setError('');
                        }}
                        className={`w-full px-4 py-1.5 rounded border ${error ? 'border-red-500' : 'border-gray-300'} bg-[#f1f3f9] focus:outline-none focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-[0_0_0_1000px_#f1f3f9_inset] [&:-webkit-autofill]:shadow-[0_0_0_1000px_#f1f3f9_inset]`}
                        placeholder="name@company.com"
                    />
                </div>

                <button
                    disabled={loading}
                    className="w-full bg-black text-white font-bold py-2 rounded hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                    {loading && <Loader className="h-4 w-4 text-white" />}
                    <Lock size={18} className="text-white" />
                    <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
                </button>

                <div className="mt-4 text-center">
                    <Link to="/login" className="text-gray-500 text-sm hover:text-gray-700">Back to Login</Link>
                </div>
            </form>
        </AuthLayout>
    );
};

export default ForgotPassword;
