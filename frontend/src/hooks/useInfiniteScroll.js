import { useState, useEffect, useCallback, useRef } from 'react';
import API from '../component/api';

export const useInfiniteScroll = ({ search = '', category = 'all', status = 'all' }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState('');
    const [totalLoaded, setTotalLoaded] = useState(0);
    const [page, setPage] = useState(1);
    const [initialized, setInitialized] = useState(false);

    // Use refs to track current filter values to prevent unnecessary re-renders
    const currentFilters = useRef({ search, category, status });
    const isLoadingRef = useRef(false);

    const loadMore = useCallback(async (resetData = false) => {
        if (isLoadingRef.current) return;

        const currentPage = resetData ? 1 : page;
        if (!resetData && !hasMore) return;

        isLoadingRef.current = true;
        setLoading(true);

        try {
            const response = await API.get('/products/', {
                params: {
                    page: currentPage,
                    search: currentFilters.current.search || '',
                    category: currentFilters.current.category !== 'all' ? currentFilters.current.category : undefined,
                    status: currentFilters.current.status !== 'all' ? currentFilters.current.status : undefined
                }
            });

            const results = response.data.results || [];

            if (resetData) {
                setItems(results);
                setTotalLoaded(results.length);
                setPage(2);
            } else {
                setItems(prev => [...prev, ...results]);
                setTotalLoaded(prev => prev + results.length);
                setPage(prev => prev + 1);
            }

            setHasMore(response.data.next !== null);
            setError('');

        } catch (err) {
            console.error('Error in loadMore:', err);
            setError('خطا در بارگیری محصولات');

            if (err.response?.status === 401) {
                setError('نشست شما منقضی شده است. در حال انتقال به صفحه ورود...');
            }
        } finally {
            setLoading(false);
            isLoadingRef.current = false;
        }
    }, [page, hasMore]);

    const updateFilters = useCallback(({ search = '', category = 'all', status = 'all', error = null }) => {
        // Check if filters actually changed
        const filtersChanged =
            currentFilters.current.search !== search ||
            currentFilters.current.category !== category ||
            currentFilters.current.status !== status;

        if (!filtersChanged && !error) return;

        // Update current filters
        currentFilters.current = { search, category, status };

        // Reset state
        setItems([]);
        setPage(1);
        setHasMore(true);
        setTotalLoaded(0);

        if (error) {
            setError(error);
        } else {
            setError('');
            // Load first page with new filters
            loadMore(true);
        }
    }, [loadMore]);

    const refresh = useCallback(async () => {
        setItems([]);
        setPage(1);
        setHasMore(true);
        setTotalLoaded(0);
        setError('');
        await loadMore(true);
    }, [loadMore]);

    // Initial load only once
    useEffect(() => {
        if (!initialized) {
            setInitialized(true);
            loadMore(true);
        }
    }, [initialized, loadMore]);

    return {
        items,
        loading,
        hasMore,
        error,
        loadMore: () => loadMore(false),
        updateFilters,
        refresh,
        totalLoaded
    };
};