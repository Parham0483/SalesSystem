import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import NeoBrutalistInput from "../component/NeoBrutalist/NeoBrutalistInput";
import NeoBrutalistButton from "../component/NeoBrutalist/NeoBrutalistButton";
import "../styles/register.css";

const API_URL = process.env.REACT_APP_API_URL;

const RegisterPage = () => {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const csrfToken = getCookie("csrftoken");
            const response = await axios.post(
                `${API_URL}customers/`,
                {
                    email,
                    name,
                    password,
                    phone,
                    company_name: companyName,
                },
                {
                    headers: {
                        "X-CSRFToken": csrfToken,
                    },
                    withCredentials: true, // needed if backend is on a different port/domain
                }
            );
            if (response.status === 201) {
                navigate("/login");
            }
        } catch (err) {
            setError("Registration failed. Please try again.");
        }
    };

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === name + "=") {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    return (
        <div className="register-container">
            <div className="register-card">
                <h2>سامانه ثبت سفارش</h2>
                {error && <p className="error">{error}</p>}
                <form onSubmit={handleRegister}>
                    <NeoBrutalistInput
                        type="email"
                        placeholder="آدرس ایمیل"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <NeoBrutalistInput
                        type="text"
                        placeholder="نام و نام خانوادگی"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <NeoBrutalistInput
                        type="password"
                        placeholder="پسورد"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <NeoBrutalistInput
                        type="tel"
                        placeholder="شماره تلفن همراه"
                        value={phone}
                        minLength={10}
                        maxLength={13}
                        onChange={(e) => {
                            const value = e.target.value;
                            // Allow only digits
                            if (/^\d*$/.test(value)) {
                                setPhone(value);
                            }
                        }}
                        required
                    />
                    <NeoBrutalistInput
                        type="text"
                        placeholder="نام شرکت"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                    />
                    <NeoBrutalistButton
                        text="ثبت نام"
                        type="submit"
                        color="yellow-400"
                        textColor="black"
                        className="register-submit-btn"
                    />
                </form>
            </div>
        </div>
    );
};

export default RegisterPage;