import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

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
                 name: response.data.name
            }));
        localStorage.setItem('token', response.data.token);           // access token
        localStorage.setItem('refreshToken', response.data.refresh);  // refresh token

        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        navigate("/dashboard");
        }


        } catch (err) {
            console.error("Login error:", err);
            setError("Invalid email or password");
            localStorage.removeItem('userData');
            localStorage.removeItem('token');
        }
    };

    return (
        <div className="login-container" id="loginPageContainer">
            <h2 className="login-title" id="loginTitle">Login</h2>
            {error && (
                <p className="error-message" id="loginError" style={{ color: "red" }}>
                    {error}
                </p>
            )}
            <form className="login-form" id="loginForm" onSubmit={handleLogin}>
                <input
                    className="input-email"
                    id="emailInput"
                    type="email"
                    placeholder="Email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    className="input-password"
                    id="passwordInput"
                    type="password"
                    placeholder="Password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button className="btn-submit" id="loginSubmitButton" type="submit">
                    Login
                </button>
            </form>
            <p className="login-register-text" id="loginRegisterText">
                Don't have an account?{" "}
                <button
                    className="btn-link-register"
                    id="goToRegisterButton"
                    onClick={() => navigate("/register")}
                >
                    Register
                </button>
            </p>
            <button
                className="btn-back-main"
                id="backToMainButton"
                onClick={() => navigate("/")}
            >
                Back to Main
            </button>
        </div>
    );
};

export default LoginPage;