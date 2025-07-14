import axios from 'axios';

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL,
    withCredentials: true
});

// Add a request interceptor
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        console.log(token)
        if (token) {

            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default API;
