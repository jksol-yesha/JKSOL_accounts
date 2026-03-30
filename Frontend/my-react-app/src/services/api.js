import axios from 'axios';
import { fetchPublicKey, encryptPayload, generateEncryptedKey, decryptResponse, clearPublicKey } from '../utils/crypto';

// Create an axios instance with a base URL
// You should update the baseURL to match your actual backend API URL.
// Using a relative path or environment variable is best practice.
const api = axios.create({
    baseURL: '/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
    }
});

// Request interceptor to add token and branchId
api.interceptors.request.use(
    async (config) => {
        // Skip encryption for public key endpoint
        if (config.url?.includes('auth/public-key')) return config;

        // Ensure public key is loaded
        await fetchPublicKey(config.baseURL || '');

        // 1. Handle POST/PUT/PATCH with Body (Full Payload Encryption)
        // Skip encryption for FormData (File Uploads) as it requires multipart handling
        const isFormData = config.data instanceof FormData;

        if (isFormData) {
            // Force deletion of Content-Type header to let axios set it correctly with the boundary for multipart
            if (config.headers['Content-Type']) {
                delete config.headers['Content-Type'];
            }
        }

        if (config.data && !isFormData && (config.method === 'post' || config.method === 'put' || config.method === 'patch')) {
            // console.log("🚀 API Interceptor Encrypting:", config.data); // DEBUG LOG
            const result = await encryptPayload(config.data);
            if (result) {
                // Store original data for retry scenarios (Server Restart / Key Mismatch)
                config._originalData = config.data;

                // Construct the payload object
                const payloadObj = {
                    encryptedKey: result.encryptedKey,
                    payload: result.payload
                };

                // Base64 encode the whole JSON object
                // btoa handles simple ASCII. JSON.stringify result is usually ASCII.
                // For safety with unicode, we can use a helper or just btoa if we trust content.
                // Assuming standard JSON output.
                config.data = btoa(JSON.stringify(payloadObj));

                // Set Header to text/plain to indicate raw string body
                config.headers['Content-Type'] = 'text/plain';

                // Store AES key in config for response decryption
                config.aesKey = result.aesKey;
            }
        }
        // 2. Handle GET/DELETE (Header-based Key Exchange)
        else if (config.method === 'get' || config.method === 'delete') {
            const result = await generateEncryptedKey();
            if (result) {
                config.headers['x-encrypted-key'] = result.encryptedKey;
                // Store AES key for response decryption
                config.aesKey = result.aesKey;
            }
        }

        const token = localStorage.getItem('accessToken');
        const isAuthException =
            config.url?.includes('/auth/login') ||
            config.url?.includes('/auth/signup') ||
            config.url?.includes('/auth/logout') ||
            config.url?.includes('/auth/public-key') ||
            config.url?.includes('/auth/refresh') ||
            config.url?.includes('/auth/forgot-password') ||
            config.url?.includes('/auth/reset-password') ||
            config.url?.includes('/auth/send-login-otp') ||
            config.url?.includes('/auth/verify-login-otp') ||
            config.url?.includes('/auth/send-invite-otp') ||
            config.url?.includes('/auth/verify-invite-otp') ||
            config.url?.includes('/auth/verify-email') ||
            config.url?.includes('/auth/get-invite-details');

        // Prevent feature API calls while logout is in progress.
        const isLoggingOut = localStorage.getItem('isLoggingOut') === '1';
        if (isLoggingOut && !isAuthException) {
            const controller = new AbortController();
            config.signal = controller.signal;
            controller.abort("Logout in progress");
            return Promise.reject(new axios.CanceledError("Logout in progress"));
        }

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        } else if (!isAuthException) {
            // [RACE CONDITION GUARD]
            // If we're hitting a protected route but don't have a token, 
            // the AUTH session isn't ready. Abort or fail immediately.
            const controller = new AbortController();
            config.signal = controller.signal;
            controller.abort("Auth session not initialized. Missing Token.");
            return Promise.reject(new Error("Missing Authentication Token"));
        }

        // Auto-inject orgId
        const storedOrg = localStorage.getItem('selectedOrg');
        if (storedOrg) {
            try {
                const orgObj = JSON.parse(storedOrg);
                if (orgObj?.id) {
                    config.headers['x-org-id'] = orgObj.id;
                }
            } catch (e) { }
        }

        // Auto-inject branchId
        const storedBranch = localStorage.getItem('selectedBranch');
        const storedBranchIds = localStorage.getItem('selectedBranchIds');
        const shouldSkipBranch = config.params?.skipBranch || config.skipBranch;

        if (!shouldSkipBranch) {
            try {
                if (storedBranchIds) {
                    const ids = JSON.parse(storedBranchIds);
                    if (Array.isArray(ids)) {
                        const cleanIds = ids.map(Number).filter(Boolean);
                        if (cleanIds.length > 1) {
                            config.headers['x-branch-id'] = 'all';
                        } else if (cleanIds.length === 1) {
                            config.headers['x-branch-id'] = cleanIds[0];
                        }
                    }
                }

                if (!config.headers['x-branch-id'] && storedBranch) {
                    const branchObj = JSON.parse(storedBranch);
                    if (branchObj?.id) {
                        config.headers['x-branch-id'] = branchObj.id === 'multi' ? 'all' : branchObj.id;
                    }
                }
            } catch (e) { }
        }

        // Auto-inject Currency Preference
        const storedPrefs = localStorage.getItem('system_preferences');
        if (storedPrefs) {
            try {
                const prefsObj = JSON.parse(storedPrefs);
                if (prefsObj?.currency) {
                    config.headers['x-base-currency'] = prefsObj.currency;
                }
            } catch (e) { }
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling and token refresh
// Token Refresh Mutex & Queue
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
    async (response) => {
        const expectsRawResponse =
            response.config?.rawResponse === true ||
            response.config?.responseType === 'blob' ||
            response.config?.responseType === 'arraybuffer';

        // Decrypt response if encrypted
        if (!expectsRawResponse && response.config.aesKey && response.data) {
            const decrypted = await decryptResponse(response.data, response.config.aesKey);
            response.data = decrypted;
        }

        // [GLOBAL ROLE NORMALIZATION]
        // Ensure any role field in the response data is lowercase
        const normalize = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (obj.role && typeof obj.role === 'string') {
                obj.role = obj.role.toLowerCase();
            }
            Object.keys(obj).forEach(key => {
                if (obj[key] && typeof obj[key] === 'object') normalize(obj[key]);
                if (Array.isArray(obj[key])) obj[key].forEach(item => normalize(item));
            });
        };
        if (!expectsRawResponse) {
            normalize(response.data);
        }

        return expectsRawResponse ? response : response.data;
    },
    async (error) => {
        // Silently ignore canceled requests
        if (axios.isCancel(error) || error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
            return Promise.reject(error);
        }
        const originalRequest = error.config;

        // DEBUG: Extensive Error Logging - ONLY for 500s or unexpected errors
        if (!error.response || error.response.status >= 500) {
            console.group("🚨 API ERROR DEBUG");
            // console.log("URL:", originalRequest?.url);
            // console.log("Status:", error.response?.status);
            // console.log("Headers sent:", originalRequest?.headers);
            // console.log("Response Data:", error.response?.data);
            console.groupEnd();
        }

        // Decrypt error response if encrypted (e.g. 400 Bad Request with message)
        if (error.response?.data && originalRequest?.aesKey) {
            try {
                const decrypted = await decryptResponse(error.response.data, originalRequest.aesKey);
                if (decrypted) {
                    error.response.data = decrypted;
                }
            } catch (e) {
                console.warn("[API] Error response decryption failed:", e);
            }
        }

        // Handle Decryption/Encryption Key Mismatch (Server Restart)
        const errorMessage = error.response?.data?.message || "";
        const isDecryptionError = errorMessage.includes("Decryption failed") || errorMessage.includes("Invalid Encrypted Key");

        if (
            (error.response?.status === 400 || error.response?.status === 500) &&
            isDecryptionError &&
            !originalRequest._retryKey
        ) {
            // console.log("Detected Key Mismatch. Clearing Public Key and Retrying...");
            originalRequest._retryKey = true;
            clearPublicKey();

            // Restore original data if it exists (for POST/PUT)
            if (originalRequest._originalData) {
                originalRequest.data = originalRequest._originalData;
            }

            // For GET/DELETE: clear header to force regeneration
            if (originalRequest.headers['x-encrypted-key']) {
                delete originalRequest.headers['x-encrypted-key'];
            }

            return api(originalRequest);
        }

        // Handle 401 Unauthorized - Token Refresh
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/auth/login') &&
            !originalRequest.url?.includes('/auth/register') &&
            !originalRequest.url?.includes('/auth/refresh') // Prevent loop if refresh fails with 401
        ) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = 'Bearer ' + token;
                    // Restore original data for retry to avoid double encryption issues
                    if (originalRequest._originalData) {
                        originalRequest.data = originalRequest._originalData;
                    }
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) {
                    throw new Error('No refresh token');
                }

                // Call refresh endpoint
                // Use a separate axios instance or explicit call to avoid interceptor loop risks, 
                // though checks above should prevent it.
                const response = await axios.post('/api/auth/refresh', { refreshToken });

                const responseData = response.data;
                const newAccessToken = responseData.data?.accessToken || responseData.accessToken;

                if (!newAccessToken) {
                    throw new Error("Failed to receive new access token");
                }

                localStorage.setItem('accessToken', newAccessToken);
                api.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;

                // Process the queue with the new token
                processQueue(null, newAccessToken);

                // Retry the original request
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                if (originalRequest._originalData) {
                    originalRequest.data = originalRequest._originalData;
                }

                // console.log("🔄 Retrying request with new token:", originalRequest.url);
                return api(originalRequest);
            } catch (refreshError) {
                // Refresh failed - logout user
                console.error("Token refresh failed:", refreshError);

                // Fail all queued requests
                processQueue(refreshError, null);

                localStorage.removeItem('user');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('isLoggingOut');

                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }

                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        if (error.response?.status >= 500 || !error.response) {
            const backendMessage =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.response?.data ||
                null;
            console.error('API Error:', {
                status: error?.response?.status,
                url: originalRequest?.url,
                message: backendMessage,
                raw: error
            });
        }
        return Promise.reject(error);
    }
);

// API Service Object
const apiService = {
    auth: {
        login: (credentials) => api.post('/auth/login', credentials),
        signup: (data) => api.post('/auth/signup', data),
        logout: (refreshToken) => api.post('/auth/logout', { refreshToken: refreshToken || undefined }),
        refreshToken: (token) => api.post('/auth/refresh', { refreshToken: token }),
        forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
        resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
        verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),

        getUsers: () => api.get('/auth/users'),
        updateProfile: (data) => api.put('/auth/profile', data),
        updatePreferences: (data) => api.put('/auth/preferences', data),
        acceptInvite: (data) => api.post('/auth/accept-invite', data),
        declineInvite: (data) => api.post('/auth/decline-invite', data),
        getInviteDetails: (token) => api.get(`/auth/get-invite-details?token=${token}`),
        // OTP Endpoints
        sendLoginOtp: (email) => api.post('/auth/send-login-otp', { email }),
        verifyLoginOtp: (email, otp) => api.post('/auth/verify-login-otp', { email, otp }),
        sendInviteOtp: (token, email) => api.post('/auth/send-invite-otp', { token, email }),
        verifyInviteOtp: (token, otp, name) => api.post('/auth/verify-invite-otp', { token, otp, name }),
    },

    branches: {
        create: (data) => api.post('/branches', data),
        getAll: (config = {}) => {
            const params = config.params || {};
            const body = { ...params };
            const reqConfig = { ...config };
            delete reqConfig.params;
            return api.post('/branches/branch-list', body, reqConfig);
        },
        update: (id, data) => api.put(`/branches/${id}`, data),
        delete: (id) => api.delete(`/branches/${id}`),
    },

    organizations: {
        create: (data) => api.post('/organizations', data),
        getAll: (config = {}) => api.post('/organizations/organization-list', {}, config),
        update: (id, data) => api.put(`/organizations/${id}`, data),
        delete: (id) => api.post('/organizations/delete', { id }),
        getMembers: (id) => api.get(`/organizations/${id}/members`),
        removeMember: (orgId, memberId) => api.delete(`/organizations/${orgId}/members/${memberId}`),
        updateMemberAccess: (orgId, memberId, data) => api.put(`/organizations/${orgId}/members/${memberId}`, data),
        invite: (id, data) => api.post(`/organizations/${id}/invite`, data),
        inviteOwner: (email, name) => api.post('/organizations/invite-owner', { email, name }),
    },
    orgs: {
        create: (data) => api.post('/organizations', data),
        getAll: () => api.post('/organizations/organization-list', {}),
        update: (id, data) => api.put(`/organizations/${id}`, data),
        delete: (id) => api.post('/organizations/delete', { id }),
        getMembers: (id) => api.get(`/organizations/${id}/members`),
        removeMember: (orgId, memberId) => api.delete(`/organizations/${orgId}/members/${memberId}`),
        invite: (id, data) => api.post(`/organizations/${id}/invite`, data),
    },

    transactions: {
        getAll: (filters = {}, config = {}) => api.post('/transactions/transaction-list', filters, config),
        export: (data, config = {}) => api.post('/transactions/export', data, config),
        getById: (id) => api.get(`/transactions/${id}`),
        create: (data) => api.post('/transactions', data),
        update: (id, data) => api.put(`/transactions/${id}`, data),
        delete: (id) => api.delete(`/transactions/${id}`),
        getTypes: () => api.get('/transactions/types'),
        import: (formData) => api.post('/transactions/import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
        importPDF: (formData) => api.post('/transactions/import-pdf', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        }),
    },

    financialYears: {
        getAll: (config = {}) => api.get('/financial-years', config),
    },

    reports: {
        get: (filters) => api.post('/reports/generate-report', filters),
        export: (filters, config = {}) => api.post('/reports/export', filters, config),
        getProfitLoss: (filters = {}, config = {}) => api.post('/reports/profit-loss', filters, config),
    },

    dashboard: {
        getSummary: (params, config) => api.post('/dashboard/summary', params, config),
        getTrends: (params, config) => api.post('/dashboard/trends', params, config),
        getCategoryRankings: (params, config) => api.post('/dashboard/rankings', params, config),
    },

    categories: {
        getAll: (params = {}, config = {}) => {
            // Support passing signal/config as second arg, or mixed if someone abuses it
            // Current usage: getAll({ branchId: ... })
            // New usage: getAll({ branchId: ... }, { signal: ... })
            return api.post('/categories/category-list', params, config);
        },
        export: (data, config = {}) => api.post('/categories/export', data, config),
        create: (data) => api.post('/categories', data),
        update: (id, data) => api.put(`/categories/${id}`, data),
        delete: (id) => api.post('/categories/delete', { id }),
        createSub: (data) => api.post('/categories/sub', data),
        updateSub: (id, data) => api.put(`/categories/sub/${id}`, data),
        deleteSub: (id) => api.delete(`/categories/sub/${id}`),
    },

    accounts: {
        create: (data, params) => {
            const queryParams = typeof params === 'object' ? params : { branchId: params };
            return api.post('/accounts', { ...data, ...queryParams });
        },
        getAll: (params = {}, config = {}) => {
            // Check if params is a primitive (branchId string) for backward compatibility
            const queryParams = (typeof params === 'object') ? params : { branchId: params };
            return api.post('/accounts/account-list', queryParams, config);
        },
        getNetSettlement: (id, config = {}) => api.post(`/accounts/${id}/net-settlement`, {}, config),
        update: (id, data) => api.put(`/accounts/${id}`, data),
        delete: (id) => api.post('/accounts/delete', { id, skipBranch: true }),
    },

    parties: {
        create: (data, params) => {
            const queryParams = typeof params === 'object' ? params : { branchId: params };
            return api.post('/parties', { ...data, ...queryParams });
        },
        getAll: (params = {}, config = {}) => {
            const queryParams = (typeof params === 'object') ? params : { branchId: params };
            return api.post('/parties/party-list', queryParams, config);
        },
        update: (id, data) => api.put(`/parties/update/${id}`, data),
        delete: (id) => api.post('/parties/delete', { id, skipBranch: true }),
    },

    auditLogs: {
        getAll: (params, config) => api.post('/audit-logs/audit-log-list', params, config),
    },

    rbac: {
        getMyPermissions: (config) => api.get('/rbac/my-permissions', config),
    },

    exchangeRates: {
        get: (from, to) => api.get(`/exchange-rates?from=${from}&to=${to}`),
    },

    countries: {
        getAll: () => api.get('/countries'),
    },

    currencies: {
        getAll: () => api.get('/currencies'),
    },

    // Generic methods
    get: (url, config) => api.get(url, config),
    post: (url, data, config) => api.post(url, data, config),
    put: (url, data, config) => api.put(url, data, config),
    delete: (url, config) => api.delete(url, config)
};

export default apiService;
