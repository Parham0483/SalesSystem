import axios from 'axios';

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});
// Add this enhanced debugging to your api.js
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`
        } else {
            console.log('❌ No token found for request:', config.url);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

API.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        console.log('❌ Response Error:', error.config?.url, error.response?.status);
        console.log('❌ Error details:', error.response?.data);

        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) {
                    throw new Error('No refresh token available');
                }

                const refreshResponse = await axios.post(
                    `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/'}auth/token/refresh/`,
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
                console.log('❌ Token refresh failed:', refreshError);
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('userData');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);export default API;