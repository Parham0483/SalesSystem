import { useState, useEffect } from 'react';
import API from '../component/api';

export const useCategories = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await API.get('/categories/');
                setCategories(response.data);
            } catch (err) {
                setError(err.message);
                // Fallback categories...
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, []);

    return { categories, loading, error };
};