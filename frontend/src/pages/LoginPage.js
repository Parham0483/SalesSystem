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
    const navigate = useNavigate();

    const getCookie = (name) => {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    };

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            // First, get CSRF token
            await axios.get(`${process.env.REACT_APP_API_URL}csrf/`, {
                withCredentials: true
            });

            const csrftoken = getCookie('csrftoken');

            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}auth/login/`,
                {
                    email,
                    password
                },
                {
                    headers: {
                        'X-CSRFToken': csrftoken,
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true
                }
            );

            if (response.status === 200) {
                localStorage.setItem('userData', JSON.stringify({
                    id: response.data.id,
                    email: response.data.email,
                    name: response.data.name,
                    is_staff: response.data.is_staff
                }));
                localStorage.setItem('token', response.data.token);           // access token
                localStorage.setItem('refreshToken', response.data.refresh);  // refresh token

                axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
                if (response.data.is_staff === true) {
                    navigate("/admin")
                } else {
                    navigate("/dashboard");
                }
            }

        } catch (err) {
            console.error("Login error:", err);
            setError("ایمیل یا پسورد را اشتباه وارد کردید");
            localStorage.removeItem('userData');
            localStorage.removeItem('token');
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
                        />
                    </div>

                    <div className="input-group">
                        <NeoBrutalistInput
                            type="password"
                            placeholder="پسورد"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <div className="button-group">
                        <NeoBrutalistButton
                            text="ورود"
                            color="yellow-400"
                            textColor="black"
                            type="submit"
                            className="submit-btn"
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
                        />
                        حساب کاربری ندارید؟{" "}
                    </p>

                    <NeoBrutalistButton
                        text="برگشت به صفحه اصلی"
                        color="yellow-400"
                        textColor="black"
                        className="btn-back-main"
                        onClick={() => navigate("/")}
                    />
                </div>
            </div>
        </div>
    );
};

export default LoginPage;