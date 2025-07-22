import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import NeoBrutalistInput from "../component/NeoBrutalist/NeoBrutalistInput";
import NeoBrutalistButton from "../component/NeoBrutalist/NeoBrutalistButton";
import "../styles/Main/login.css";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        console.log('🚀 Starting login process...');

        try {
            const loginData = { email, password };

            console.log('📤 Sending login request for:', email);

            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/'}auth/login/`,
                loginData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true
                }
            );

            console.log('✅ Login response:', response.data);

            if (response.status === 200) {
                const { user, tokens } = response.data;

                console.log('🔑 Storing authentication data:', {
                    user: user,
                    hasTokens: !!tokens,
                    isDealer: user.is_dealer, // LOG DEALER STATUS
                    isStaff: user.is_staff,
                    accessToken: tokens?.access ? `${tokens.access.substring(0, 20)}...` : null,
                    refreshToken: tokens?.refresh ? `${tokens.refresh.substring(0, 20)}...` : null
                });

                // Store user data - INCLUDE is_dealer field
                localStorage.setItem('userData', JSON.stringify({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    is_staff: user.is_staff,
                    is_dealer: user.is_dealer,        // ← ADD THIS FIELD
                    company_name: user.company_name
                }));

                // Store tokens
                localStorage.setItem('access_token', tokens.access);
                localStorage.setItem('refresh_token', tokens.refresh);

                // CRITICAL: Set the authorization header for future requests
                axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.access}`;

                console.log('✅ Authentication data stored successfully');
                console.log('🔍 Verification - localStorage check:', {
                    userData: !!localStorage.getItem('userData'),
                    accessToken: !!localStorage.getItem('access_token'),
                    refreshToken: !!localStorage.getItem('refresh_token'),
                    axiosHeader: axios.defaults.headers.common['Authorization']
                });

                // UPDATED: Navigate based on user role INCLUDING DEALER
                setTimeout(() => {
                    if (user.is_staff) {
                        console.log('🔄 Navigating to admin dashboard...');
                        navigate("/admin");
                    } else if (user.is_dealer) {
                        console.log('🔄 Navigating to dealer dashboard...');
                        navigate("/dealer");
                    } else {
                        console.log('🔄 Navigating to customer dashboard...');
                        navigate("/dashboard");
                    }
                }, 100);
            }

        } catch (err) {
            console.error("❌ Login error:", err);

            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else if (err.response?.status === 401) {
                setError("ایمیل یا پسورد را اشتباه وارد کردید");
            } else {
                setError("خطا در ورود به سیستم. لطفاً دوباره تلاش کنید.");
            }

            // Clear any existing tokens on login failure
            localStorage.removeItem('userData');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            delete axios.defaults.headers.common['Authorization'];
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" id="loginPageContainer">
            <div className="login-box">
                <h2 className="login-title" id="loginTitle">سامانه ثبت سفارش</h2>

                {error && (
                    <div className="error-message" id="loginError">
                        {error}
                    </div>
                )}

                <form className="login-form" id="loginForm" onSubmit={handleLogin}>
                    <div className="input-group">
                        <NeoBrutalistInput
                            type="email"
                            placeholder="ایمیل خود را وارد کنید"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="input-group">
                        <NeoBrutalistInput
                            type="password"
                            placeholder="پسورد"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="button-group">
                        <NeoBrutalistButton
                            text={loading ? "در حال ورود..." : "ورود"}
                            color="yellow-400"
                            textColor="black"
                            type="submit"
                            className="submit-btn"
                            disabled={loading}
                        />
                    </div>
                </form>

                <div className="login-footer">
                    <p className="login-register-text" id="loginRegisterText">
                        <NeoBrutalistButton
                            text="ثبت نام"
                            color="yellow-400"
                            textColor="black"
                            className="btn-link-register"
                            onClick={() => navigate("/register")}
                            disabled={loading}
                        />
                        حساب کاربری ندارید؟{" "}
                    </p>

                    <NeoBrutalistButton
                        text="برگشت به صفحه اصلی"
                        color="yellow-400"
                        textColor="black"
                        className="btn-back-main"
                        onClick={() => navigate("/")}
                        disabled={loading}
                    />
                </div>
            </div>
        </div>
    );
};

export default LoginPage;