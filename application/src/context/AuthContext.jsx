import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import AuthContext from './AuthContextDefinition';

const DASHBOARD_RECENT_TXN_COLUMNS_PREFIX = 'dashboard:recentTxColumns:v1';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const normalizeUser = (rawUser) => {
        if (!rawUser) return null;
        const fullName = rawUser.fullName || rawUser.name || '';
        const emailPrefix = rawUser.email ? String(rawUser.email).split('@')[0] : '';
        const resolvedName = fullName || emailPrefix || 'User';
        return {
            ...rawUser,
            fullName: fullName || resolvedName,
            name: resolvedName
        };
    };

    const clearUserScopedUiState = React.useCallback(() => {
        Object.keys(localStorage).forEach((key) => {
            if (key.startsWith(DASHBOARD_RECENT_TXN_COLUMNS_PREFIX)) {
                localStorage.removeItem(key);
            }
        });
    }, []);

    const clearPersistedAuthSession = React.useCallback(() => {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('selectedOrg');
        localStorage.removeItem('selectedBranch');
        localStorage.removeItem('selectedYear');
        localStorage.removeItem('isLoggingOut');
        clearUserScopedUiState();
    }, [clearUserScopedUiState]);

    useEffect(() => {
        const initAuth = async () => {
            // Check for persisted user and token
            const storedUser = localStorage.getItem('user');
            const accessToken = localStorage.getItem('accessToken');

            // Clear any stuck logout flags from interrupted sessions
            localStorage.removeItem('isLoggingOut');

            if (storedUser && accessToken) {
                try {
                    const parsedUser = JSON.parse(storedUser);
                    // Normalize role to lowercase for consistency
                    if (parsedUser && parsedUser.role) {
                        parsedUser.role = parsedUser.role.toLowerCase();
                    }
                    setUser(normalizeUser(parsedUser));
                    // Ensure API has the token immediately before any child components mount
                    // apiService.defaults.headers... (handled by interceptor, but interceptor reads localStorage)
                } catch (e) {
                    console.error("Failed to parse stored user:", e);
                    clearPersistedAuthSession();
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, [clearPersistedAuthSession]);



    const loginSuccess = (user, accessToken, refreshToken) => {
        if (!accessToken) {
            console.error("Access Token missing in loginSuccess");
            return;
        }
        localStorage.removeItem('isLoggingOut');

        // 1. Perform all localStorage updates first (Sync)
        const normalizedUser = normalizeUser(user);

        localStorage.setItem('user', JSON.stringify(normalizedUser));
        localStorage.setItem('accessToken', accessToken);
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }

        // Clear stale selection data first
        localStorage.removeItem('selectedOrg');
        localStorage.removeItem('selectedBranch');
        localStorage.removeItem('selectedYear');



        // Set default selection based on user data
        if (normalizedUser.orgIds) {
            const orgIds = typeof normalizedUser.orgIds === 'string'
                ? normalizedUser.orgIds.split(',')
                : (Array.isArray(normalizedUser.orgIds) ? normalizedUser.orgIds : []);

            if (orgIds.length > 0) {
                const firstOrgId = orgIds[0];
                localStorage.setItem('selectedOrg', JSON.stringify({ id: Number(firstOrgId) }));
            }
        }

        if (normalizedUser.branchIds) {
            const branchIds = typeof normalizedUser.branchIds === 'string'
                ? normalizedUser.branchIds.split(',')
                : (Array.isArray(normalizedUser.branchIds) ? normalizedUser.branchIds : []);

            if (branchIds.length > 0) {
                const firstBranchId = branchIds[0];
                localStorage.setItem('selectedBranch', JSON.stringify({ id: Number(firstBranchId) }));
            }
        }

        // 2. Update React state last to trigger re-renders only after storage is ready
        setUser(normalizedUser);

        // 3. Notify PreferenceContext to re-sync from the new user's data
        window.dispatchEvent(new Event('userSwitched'));
    };

    // Sync User State with LocalStorage
    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                // User is null -> Clear storage
                // This happens AFTER the state update has propagated to children
                clearPersistedAuthSession();
            }
        }
    }, [clearPersistedAuthSession, user, isLoading]);

    const logout = async (shouldRedirect = true) => {
        const refreshToken = localStorage.getItem('refreshToken');
        localStorage.setItem('isLoggingOut', '1');
        clearUserScopedUiState();

        // Tear down protected UI immediately so feature effects stop before they can queue more requests.
        setUser(null);
        if (shouldRedirect) {
            navigate('/login');
        }

        try {
            // Attempt to notify server of logout
            if (refreshToken) {
                await apiService.auth.logout(refreshToken);
            }
        } catch (error) {
            console.error("Logout API failed (harmless since local session is cleared)", error);
        }
    };

    const updateUser = async (updatedData) => {
        try {
            const response = await apiService.auth.updateProfile(updatedData);
            const payload = response?.data || response;
            const updatedUser =
                payload?.user ||
                payload?.data?.user ||
                payload?.data ||
                payload ||
                {};
            const mergedUser = { ...user, ...updatedUser, ...updatedData };
            if (updatedData?.name) {
                mergedUser.fullName = updatedData.name;
            } else if (updatedUser?.name && !updatedUser?.fullName) {
                mergedUser.fullName = updatedUser.name;
            }
            const newData = normalizeUser(mergedUser);

            setUser(newData);
            localStorage.setItem('user', JSON.stringify(newData));
            return newData;
        } catch (error) {
            console.error("Update profile failed", error);
            throw error;
        }
    };


    return (
        <AuthContext.Provider value={{
            user,
            loginSuccess,
            logout,
            updateUser,
            isLoading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
