import axios from 'axios';

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Add a request interceptor to include the access token
API.interceptors.request.use(
    (config) => {
        // Get access token from localStorage (updated key name)
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add a response interceptor to handle token refresh
API.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If we get a 401 error and haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (refreshToken) {
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

                    // Update the authorization header for the original request
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

                    // Retry the original request
                    return API(originalRequest);
                }
            } catch (refreshError) {
                // Refresh failed, redirect to login
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