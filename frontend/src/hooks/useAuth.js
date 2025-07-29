import { useState, useEffect } from 'react';

export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [isDealer, setIsDealer] = useState(false);
    const [idAdmin, setIdAdmin] = useState(false);

    useEffect(() => {
        const userDataString = localStorage.getItem('userData');
        if (userDataString) {
            const userData = JSON.parse(userDataString);

            setUser(userData);
            setIsDealer(!!(userData?.is_dealer));

        }
    }, []);

    return { user, isDealer };
};