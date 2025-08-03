import axios from 'axios';

// Use environment variable without fallback
const API_BASE_URL = process.env.REACT_APP_API_URL;

if (!API_BASE_URL) {
    console.error('❌ REACT_APP_API_URL is not defined!');
    console.log('Available env vars:', process.env);
}

const API = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

console.log('🔧 API Base URL:', API_BASE_URL);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);

// Add this enhanced debugging to your api.js
API.interceptors.request.use(
    (config) => {
        console.log('🚀 API Request:', config.method?.toUpperCase(), config.baseURL + config.url);
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`
        }
        return config;
    },
    (error) => Promise.reject(error)
);

API.interceptors.response.use(
    (response) => {
        console.log('✅ API Response:', response.status, response.config.url);
        return response;
    },
    async (error) => {
        console.error('❌ API Error:', error.response?.status, error.config?.url, error.message);

        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) {
                    throw new Error('No refresh token available');
                }

                const refreshResponse = await axios.post(
                    `${API_BASE_URL}auth/token/refresh/`,
                    { refresh: refreshToken },
                    {
                        headers: { 'Content-Type': 'application/json' },
                        withCredentials: true
                    }
                );

                const newAccessToken = refreshResponse.data.access;
                localStorage.setItem('access_token', newAccessToken);

                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                return API(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('userData');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default API;
