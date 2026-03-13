import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import apiService from '../../services/api';
import AuthLayout from './AuthLayout';

const EnterOtp = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { loginSuccess } = useAuth();
    const { showToast } = useToast();

    const { email, token, flow, name } = location.state || {};
    const OTP_TIMER_KEY = `otp_timer_${email || token || 'default'}`;

    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(() => {
        if (!email && !token) return 300;
        const storedExpiration = sessionStorage.getItem(OTP_TIMER_KEY);
        if (storedExpiration) {
            const remaining = Math.floor((parseInt(storedExpiration, 10) - Date.now()) / 1000);
            return remaining > 0 ? remaining : 0;
        }
        return 300;
    });

    useEffect(() => {
        if (!flow || (!email && !token)) {
            showToast('Invalid access. Please login again.', 'error');
            navigate('/login');
            return;
        }

        if (!sessionStorage.getItem(OTP_TIMER_KEY)) {
            sessionStorage.setItem(OTP_TIMER_KEY, (Date.now() + 300 * 1000).toString());
        }

        const interval = setInterval(() => {
            setTimer((prev) => {
                if (prev <= 1) {
                    sessionStorage.removeItem(OTP_TIMER_KEY);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [flow, email, token, navigate, showToast, OTP_TIMER_KEY]);

    const handleChange = (element, index) => {
        if (!/^\d*$/.test(element.value)) return; // Strictly allow only digits

        const newOtp = [...otp];
        newOtp[index] = element.value;
        setOtp(newOtp);

        // Focus next input
        if (element.nextSibling && element.value) {
            element.nextSibling.focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otp[index] && e.target.previousSibling) {
            e.target.previousSibling.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 6).split('').filter(char => /\d/.test(char));
        if (pastedData.length > 0) {
            const newOtp = [...otp];
            pastedData.forEach((char, i) => {
                if (i < 6) newOtp[i] = char;
            });
            setOtp(newOtp);
            // Focus last filled input or next available
            const focusIndex = Math.min(pastedData.length, 5);
            const inputs = document.querySelectorAll('input[type="text"]');
            if (inputs[focusIndex]) inputs[focusIndex].focus();
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleResendOtp = async () => {
        if (timer > 0) return;

        setIsLoading(true);
        try {
            if (flow === 'login') {
                await apiService.auth.sendLoginOtp(email);
            } else if (flow === 'invite') {
                await apiService.auth.sendInviteOtp(token);
            }
            setTimer(300);
            sessionStorage.setItem(OTP_TIMER_KEY, (Date.now() + 300 * 1000).toString());
            showToast('OTP resent successfully', 'success');
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to resend OTP', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const isSubmittingRef = useRef(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSubmittingRef.current) return;

        const otpString = otp.join('');
        if (otpString.length !== 6) {
            showToast('Please enter a valid 6-digit OTP', 'error');
            return;
        }

        isSubmittingRef.current = true;
        setIsLoading(true);

        try {
            let response;
            if (flow === 'login') {
                response = await apiService.auth.verifyLoginOtp(email, otpString);
            } else if (flow === 'invite') {
                let inviteName = name;
                if (!inviteName && token) {
                    try {
                        const inviteDetailsRes = await apiService.auth.getInviteDetails(token);
                        const inviteDetails = inviteDetailsRes?.data || inviteDetailsRes || {};
                        inviteName =
                            inviteDetails.name ||
                            inviteDetails.invitedName ||
                            inviteDetails.fullName ||
                            '';
                    } catch (inviteDetailsErr) {
                        // Fallback to backend defaults if invite details fetch fails.
                    }
                }
                response = await apiService.auth.verifyInviteOtp(token, otpString, inviteName);
            }

            if (response.success) {
                const { accessToken, refreshToken, user, joinedOrgId, joinedBranchIds } = response.data;

                // If invitation flow, automatically scope the user to the joined organization
                if (flow === 'invite' && joinedOrgId) {
                    localStorage.setItem('selectedOrg', JSON.stringify({ id: joinedOrgId }));
                    if (joinedBranchIds) {
                        const firstBranchId = joinedBranchIds.split(',')[0];
                        if (firstBranchId) {
                            localStorage.setItem('selectedBranch', JSON.stringify({ id: parseInt(firstBranchId) }));
                        }
                    }
                }

                sessionStorage.removeItem(OTP_TIMER_KEY);

                // Use loginSuccess to update state without making another API call
                loginSuccess(user, accessToken, refreshToken);
                showToast(flow === 'invite' ? 'Welcome to the organization!' : 'Login successful', 'success');
                navigate('/dashboard');
            }
        } catch (error) {
            console.error("OTP Verification Error:", error);
            const msg = error.response?.data?.message || 'Verification failed';
            // Only show error if it's NOT "already used" coming from a race condition (hard to detect perfectly frontend side, but preventing double submit helps)
            showToast(msg, 'error');
            isSubmittingRef.current = false; // Allow retry on failure
        } finally {
            setIsLoading(false);
            // Note: we don't reset isSubmittingRef on success because we are navigating away
            if (!localStorage.getItem('token')) { // Simple check if we are still on page/not logged in
                isSubmittingRef.current = false;
            }
        }
    };

    return (
        <AuthLayout
            title="Enter Verification Code"
            subtitle={`We've sent a code to ${email || 'your email'}`}
        >
            <form onSubmit={handleSubmit} className="w-full">
                <div className="flex justify-between gap-2 mb-8">
                    {otp.map((data, index) => (
                        <input
                            key={index}
                            type="text"
                            className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold border border-gray-300 rounded-lg focus:border-black focus:outline-none transition-colors"
                            maxLength="1"
                            value={data}
                            onChange={(e) => handleChange(e.target, index)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            onPaste={handlePaste}
                            onFocus={(e) => e.target.select()}
                        />
                    ))}
                </div>

                <button
                    type="submit"
                    className="w-full bg-black text-white p-2 rounded font-bold hover:bg-gray-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={isLoading || otp.join('').length !== 6}
                >
                    {isLoading ? 'Verifying...' : 'Verify'}
                </button>

                <div className="mt-6 text-center text-sm text-gray-600">
                    {timer > 0 ? (
                        <p>Resend code in <span className="font-bold text-black">{formatTime(timer)}</span></p>
                    ) : (
                        <button
                            type="button"
                            className="text-black font-bold hover:underline"
                            onClick={handleResendOtp}
                            disabled={isLoading}
                        >
                            Resend Code
                        </button>
                    )}
                </div>
            </form>
        </AuthLayout>
    );
};

export default EnterOtp;
