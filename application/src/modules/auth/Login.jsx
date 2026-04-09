import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { isValidEmail, isRequired } from '../../utils/validation';
import { useFormNavigation } from '../../hooks/useFormNavigation';
import apiService from '../../services/api';
import { Loader } from '../../components/common/Loader';

const Login = () => {
    const location = useLocation();
    const [email, setEmail] = useState(() => location.state?.email || '');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const redirectTimerRef = useRef(null);

    // Redirect if already logged in
    React.useEffect(() => {
        if (user) {
            navigate('/dashboard', { replace: true });
        }
    }, [user, navigate]);

    // Prevent browser history navigation away from login
    React.useEffect(() => {
        window.history.pushState(null, null, window.location.href);
        const handlePopState = () => {
            window.history.pushState(null, null, window.location.href);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

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
        if (!validateForm()) {
            return;
        }

        setLoading(true);
        try {
            await apiService.auth.sendLoginOtp(email.toLowerCase());
            showToast('OTP sent successfully. Redirecting to verification...', 'success');
            redirectTimerRef.current = setTimeout(() => {
                navigate('/enter-otp', { state: { email: email.toLowerCase(), flow: 'login' } });
            }, 900);
        } catch (err) {
            if (!err.response || err.response.status >= 500) {
                console.error("Login Error:", err);
            }
            showToast(err.response?.data?.message || 'Something went wrong. Please try again.', 'error');
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

                <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">Email</label>
                    <input
                        ref={emailRef}
                        onKeyDown={(e) => handleKeyDown(e, 0)}
                        type="email"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value.toLowerCase());
                            if (emailError) setEmailError('');
                        }}
                        className={`w-full h-10 px-3 text-[13px] bg-white border ${emailError ? 'border-red-500' : 'border-slate-300'} rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400`}
                        placeholder="name@company.com"
                        disabled={loading}
                    />
                    {emailError && <p className="text-red-500 text-xs mt-1.5 font-medium">{emailError}</p>}
                </div>

                <button
                    type="submit"
                    className="w-full h-10 bg-slate-900 text-white rounded-md text-[13px] font-semibold hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
                    disabled={loading}
                >
                    {loading ? <Loader className="text-emerald-400 h-5 w-5" /> : 'Continue'}
                </button>
            </form>
        </AuthLayout>
    );
};

export default Login;
