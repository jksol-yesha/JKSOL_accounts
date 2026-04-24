
import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../context/AuthContext';

const EmailVerification = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { verifyEmail } = useAuth();

    // Get email from location state or fallback to null
    const [email] = useState(location.state?.email || '');

    // State for the 6 digit code
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Refs for all 6 inputs
    const inputRefs = useRef([]);

    // Focus first input on mount
    useEffect(() => {
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, []);

    const handleChange = (index, value) => {
        // Only allow numbers
        if (!/^\d*$/.test(value)) return;

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Auto move to next input if value is entered
        if (value && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        // Handle Backspace: move to previous input if empty
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
        if (pastedData.length === 0) return;

        const newCode = [...code];
        pastedData.forEach((char, index) => {
            if (index < 6 && /^\d$/.test(char)) {
                newCode[index] = char;
            }
        });
        setCode(newCode);

        // Focus the input after the last pasted character
        const nextIndex = Math.min(pastedData.length, 5);
        inputRefs.current[nextIndex].focus();
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();

        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setError('Please enter the complete 6-digit code');
            return;
        }

        setIsLoading(true);
        setError('');
        try {
            await verifyEmail(fullCode);
            setSuccess('Email verified successfully! Redirecting to login...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            console.error('Verification failed', err);
            setError(err.response?.data?.message || 'Verification failed. Please check the code and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout title="Verify Your Email" subtitle={`We've sent a 6-digit code to ${email || 'your email'}.`}>
            <form onSubmit={handleSubmit} className="w-full">
                {error && (
                    <div className="mb-4 bg-red-50 text-red-500 text-sm p-3 rounded text-center">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-4 bg-sky-50 text-sky-600 text-sm p-3 rounded text-center">
                        {success}
                    </div>
                )}

                <div className="mb-8">
                    <label className="block text-sm font-bold text-gray-700 mb-3 text-center">Enter Verification Code</label>
                    <div className="flex justify-center gap-2 sm:gap-3">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={el => inputRefs.current[index] = el}
                                type="text"
                                maxLength="1"
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset]"
                            />
                        ))}
                    </div>
                </div>

                <button
                    disabled={isLoading || success}
                    className="w-full bg-black text-white font-bold py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                    {isLoading && <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>}
                    <span>{isLoading ? 'Verifying...' : 'Verify Email'}</span>
                </button>

                <div className="mt-6 text-center">
                    <span className="text-gray-600 text-sm">Didn't receive the code? </span>
                    <button type="button" className="text-black font-bold text-sm hover:underline">Resend Code</button>
                </div>

                <div className="mt-4 text-center">
                    <button type="button" onClick={() => navigate('/login')} className="text-gray-500 text-sm hover:text-gray-700">Back to Login</button>
                </div>
            </form>
        </AuthLayout>
    );
};

export default EmailVerification;
