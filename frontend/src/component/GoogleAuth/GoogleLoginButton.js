import React, { useState } from "react";
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from "react-router-dom";
import axios from "axios";
import NeoBrutalistButton from "../NeoBrutalist/NeoBrutalistButton";

const GoogleLoginButton = ({ onSuccess, onError }) => {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || '/api/'}auth/google/`,
                {
                    id_token: credentialResponse.credential // Send ID token to backend
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true
                }
            );

            if (response.status === 200) {
                const { user, tokens, created, needs_profile_completion, missing_fields } = response.data;


                // Store user data
                localStorage.setItem('userData', JSON.stringify({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    is_staff: user.is_staff,
                    is_dealer: user.is_dealer,
                    company_name: user.company_name,
                    phone: user.phone
                }));

                // Store tokens
                localStorage.setItem('access_token', tokens.access);
                localStorage.setItem('refresh_token', tokens.refresh);

                // Set authorization header
                axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.access}`;

                // Check if profile completion is needed
                if (needs_profile_completion) {
                    navigate("/complete-profile", {
                        state: {
                            user: user,
                            missing_fields: missing_fields,
                            isGoogleUser: true
                        }
                    });
                } else {
                    // Navigate based on user role
                    if (user.is_staff) {
                        navigate("/admin");
                    } else if (user.is_dealer) {
                        navigate("/dealer");
                    } else {
                        navigate("/dashboard");
                    }
                }

                if (onSuccess) {
                    onSuccess(user);
                }
            }

        } catch (err) {
            console.error("❌ Google login error:", err);

            let errorMessage = "خطا در ورود با Google. لطفاً دوباره تلاش کنید.";

            if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err.response?.status === 400) {
                errorMessage = "اطلاعات Google نامعتبر است";
            }

            if (onError) {
                onError(errorMessage);
            }

            // Clear any existing tokens on error
            localStorage.removeItem('userData');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            delete axios.defaults.headers.common['Authorization'];
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleError = (error) => {
        console.error("❌ Google login failed:", error);
        const errorMessage = "ورود با Google ناموفق بود. لطفاً دوباره تلاش کنید.";

        if (onError) {
            onError(errorMessage);
        }
    };

    return (
        <div className="google-login-container">
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap={false}
                auto_select={false}
                cancel_on_tap_outside={true}
                size="large"
                theme = "filled_yellow"
                text="signin_with"
                locale="fa"
                disabled={loading}
            />

            {loading && (
                <div className="google-loading" style={{
                    marginTop: '10px',
                    textAlign: 'center',
                    color: '#666'
                }}>
                    در حال ورود با Google...
                </div>
            )}
        </div>
    );
};

export default GoogleLoginButton;