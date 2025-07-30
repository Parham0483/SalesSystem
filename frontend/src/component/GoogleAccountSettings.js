import React, { useState } from 'react';
import axios from 'axios';
import NeoBrutalistButton from '../NeoBrutalist/NeoBrutalistButton';

const GoogleAccountSettings = ({ user, onUpdate }) => {
    const [linking, setLinking] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleLinkGoogle = async (credentialResponse) => {
        setLinking(true);
        setError('');
        setSuccess('');

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/auth/google/link-account/`,
                {
                    id_token: credentialResponse.credential
                },
                {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    }
                }
            );

            if (response.status === 200) {
                setSuccess('Google account linked successfully!');
                if (onUpdate) {
                    onUpdate(response.data.user);
                }
            }

        } catch (err) {
            console.error('Error linking Google account:', err);
            setError(err.response?.data?.error || 'Failed to link Google account');
        } finally {
            setLinking(false);
        }
    };

    return (
        <div className="google-account-settings">
            <h3>Google Account Integration</h3>

            {user.google_id ? (
                <div className="google-linked">
                    <p>✅ Google account is linked to your profile</p>
                    <p>You can sign in using Google or your regular password</p>
                </div>
            ) : (
                <div className="google-not-linked">
                    <p>🔗 Link your Google account for faster sign-in</p>

                    {/* This would use GoogleLogin component */}
                    <NeoBrutalistButton
                        text="Link Google Account"
                        color="blue-500"
                        textColor="white"
                        onClick={() => {
                            // This would trigger Google OAuth flow
                            alert('Google account linking would be implemented here');
                        }}
                        disabled={linking}
                    />
                </div>
            )}

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
        </div>
    );
};

export default GoogleAccountSettings;