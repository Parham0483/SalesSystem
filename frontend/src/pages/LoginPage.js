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
        <div className="login-container">
            <h2>Login</h2>
            {error && <p className="error">{error}</p>}
            <form onSubmit={handleLogin}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Login</button>
                <button
                    type="button"
                    onClick={() => navigate("/register")}
                    style={{ marginLeft: "10px" }}
                >
                    Register
                </button>
            </form>
        </div>
    );
};

export default LoginPage;