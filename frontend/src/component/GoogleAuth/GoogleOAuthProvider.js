// frontend/src/components/GoogleAuth/GoogleOAuthProvider.js - SECURE VERSION
import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GoogleAuthProvider = ({ children }) => {
    // Get Client ID from environment variable
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

    // Validate that Client ID is available
    if (!clientId) {
        console.error('❌ REACT_APP_GOOGLE_CLIENT_ID environment variable is required');
        return (
            <div style={{
                padding: '20px',
                background: '#ffebee',
                border: '2px solid #f44336',
                margin: '20px',
                textAlign: 'center'
            }}>
                <h3>Google OAuth Configuration Error</h3>
                <p>REACT_APP_GOOGLE_CLIENT_ID environment variable is missing.</p>
                <p>Please check your .env file.</p>
            </div>
        );
    }

    console.log(`✅ Google OAuth Provider initialized with Client ID: ${clientId.substring(0, 20)}...`);

    return (
        <GoogleOAuthProvider clientId={clientId}>
            {children}
        </GoogleOAuthProvider>
    );
};

export default GoogleAuthProvider;