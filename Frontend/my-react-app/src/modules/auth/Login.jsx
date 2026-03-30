import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { isValidEmail, isRequired } from '../../utils/validation';
import { useFormNavigation } from '../../hooks/useFormNavigation';
import apiService from '../../services/api';

const Login = () => {
    const location = useLocation();
    const [email, setEmail] = useState(() => location.state?.email || '');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();
    const redirectTimerRef = useRef(null);

    // Redirect if already logged in
    React.useEffect(() => {
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    React.useEffect(() => {
        return () => {
            if (redirectTimerRef.current) {
                clearTimeout(redirectTimerRef.current);
            }
        };
    }, []);

    // Refs for navigation
    const emailRef = useRef(null);

    // Only email is in the navigation flow
    const inputs = [emailRef];

    const validateForm = () => {
        let isValid = true;
        setEmailError('');

        if (!isRequired(email)) {
            setEmailError('Email is required');
            isValid = false;
        } else if (!isValidEmail(email)) {
            setEmailError('Please enter a valid email address');
            isValid = false;
        }

        return isValid;
    };

    const submitForm = async () => {
        setError('');
        setSuccess('');

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            await apiService.auth.sendLoginOtp(email.toLowerCase());
            setSuccess('OTP sent successfully. Redirecting to verification...');
            redirectTimerRef.current = setTimeout(() => {
                navigate('/enter-otp', { state: { email: email.toLowerCase(), flow: 'login' } });
            }, 900);
        } catch (err) {
            if (!err.response || err.response.status >= 500) {
                console.error("Login Error:", err);
            }
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        submitForm();
    };

    const handleKeyDown = useFormNavigation(inputs, submitForm);

    return (
        <AuthLayout title="Welcome Back" subtitle="Please enter your email to sign in.">
            <form onSubmit={handleSubmit} className="w-full" noValidate>

                <div className="mb-3">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                    <input
                        ref={emailRef}
                        onKeyDown={(e) => handleKeyDown(e, 0)}
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value.toLowerCase());
                            if (emailError) setEmailError('');
                        }}
                        className={`w-full h-10 px-3 border ${emailError ? 'border-red-500' : 'border-gray-300'} rounded focus:outline-none focus:border-black transition-colors`}
                        placeholder="Enter your email"
                        disabled={loading}
                    />
                    {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
                </div>

                <button
                    type="submit"
                    className="w-full bg-black text-white p-2 mb-3 rounded font-bold hover:bg-gray-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={loading}
                >
                    {loading ? 'Sending Request...' : 'Send OTP'}
                </button>

                {error && <div className="mt-4 text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}
                {success && <div className="mt-4 text-emerald-700 text-sm text-center bg-emerald-50 p-2 rounded">{success}</div>}
            </form>
        </AuthLayout>
    );
};

export default Login;
