import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import NeoBrutalistInput from "../component/NeoBrutalist/NeoBrutalistInput";
import NeoBrutalistButton from "../component/NeoBrutalist/NeoBrutalistButton";
import "../styles/login.css";

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

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/'}auth/login/`,
                {
                    email,
                    password
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true
                }
            );

            if (response.status === 200) {
                const { user, tokens } = response.data;

                // Store user data and tokens with updated structure
                localStorage.setItem('userData', JSON.stringify({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    is_staff: user.is_staff,
                    company_name: user.company_name
                }));

                // Store tokens with correct keys
                localStorage.setItem('access_token', tokens.access);
                localStorage.setItem('refresh_token', tokens.refresh);

                // Set default authorization header
                axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.access}`;

                // Navigate based on user role
                if (user.is_staff) {
                    navigate("/admin");
                } else {
                    navigate("/dashboard");
                }
            }

        } catch (err) {
            console.error("Login error:", err);

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