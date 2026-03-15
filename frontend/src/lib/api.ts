import axios from 'axios';

const getBaseUrl = () => {
    return 'https://scriptishrxcodebase.onrender.com/api';
};

const api = axios.create({
    baseURL: getBaseUrl(),
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ✅ Request Interceptor: Attach Token
api.interceptors.request.use((config) => {
    if (typeof window === 'undefined') return config; // ✅ Skip entirely on SSR

    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ✅ Response Interceptor: Handle 401
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (typeof window === 'undefined') {
            // ✅ On SSR, never attempt refresh or localStorage access
            return Promise.reject(error);
        }

        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const baseUrl = getBaseUrl();
                const { data } = await axios.post(`${baseUrl}/auth/refresh`, {}, {
                    withCredentials: true
                });

                // ✅ Safe optional chaining — no destructuring
                const newToken = data?.auth?.token;

                if (newToken) {
                    localStorage.setItem('token', newToken);
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;