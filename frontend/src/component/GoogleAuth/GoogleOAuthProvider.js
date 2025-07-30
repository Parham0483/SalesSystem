import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GoogleAuthProvider = ({ children }) => {
    // Use your Google Client ID from the JSON file
    const clientId = "775814213572-h7009vmkdj87gpuko2puh3n22oesfnj5.apps.googleusercontent.com";

    return (
        <GoogleOAuthProvider clientId={clientId}>
            {children}
        </GoogleOAuthProvider>
    );
};

export default GoogleAuthProvider;
