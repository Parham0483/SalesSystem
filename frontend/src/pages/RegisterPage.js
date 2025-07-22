import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import NeoBrutalistInput from "../component/NeoBrutalist/NeoBrutalistInput";
import NeoBrutalistButton from "../component/NeoBrutalist/NeoBrutalistButton";
import "../styles/Main/register.css";

const RegisterPage = () => {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        console.log('🚀 Starting registration process...');

        try {
            const registrationData = {
                email,
                name,
                password,
                phone,
                company_name: companyName,
            };

            console.log('📤 Sending registration data:', { ...registrationData, password: '[HIDDEN]' });

            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/'}auth/register/`,
                registrationData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true
                }
            );

            console.log('✅ Registration response:', response.data);

            if (response.status === 201) {
                const { user } = response.data;

                // SUCCESS: Show message and redirect to login
                alert(`${user.name} عزیز، ثبت نام با موفقیت انجام شد! لطفاً وارد شوید.`);

                // Redirect to login page (no token storage during registration)
                navigate("/login", {
                    state: {
                        registeredEmail: user.email,
                        message: 'ثبت نام موفقیت‌آمیز بود. لطفاً وارد شوید.'
                    }
                });
            }

        } catch (err) {
            console.error("❌ Registration error:", err);

            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else if (err.response?.data?.details) {
                // Handle validation errors
                const details = err.response.data.details;
                const errorMessages = Object.values(details).flat();
                setError(errorMessages.join(', '));
            } else if (err.response?.status === 400) {
                setError("خطا در اطلاعات وارد شده. لطفاً دوباره بررسی کنید.");
            } else {
                setError("خطا در ثبت نام. لطفاً دوباره تلاش کنید.");
            }
        } finally {
            setLoading(false);
        }
    };

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
                        disabled={loading}
                    />
                    <NeoBrutalistInput
                        type="text"
                        placeholder="نام و نام خانوادگی"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={loading}
                    />
                    <NeoBrutalistInput
                        type="password"
                        placeholder="پسورد"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        disabled={loading}
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
                        disabled={loading}
                    />
                    <NeoBrutalistInput
                        type="text"
                        placeholder="نام شرکت (اختیاری)"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        disabled={loading}
                    />
                    <NeoBrutalistButton
                        text={loading ? "در حال ثبت نام..." : "ثبت نام"}
                        type="submit"
                        color="yellow-400"
                        textColor="black"
                        className="register-submit-btn"
                        disabled={loading}
                    />
                </form>

                <div className="register-footer">
                    <NeoBrutalistButton
                        text="قبلاً ثبت نام کرده‌اید؟ ورود"
                        color="yellow-400"
                        textColor="white"
                        onClick={() => navigate("/login")}
                        disabled={loading}
                    />
                    <NeoBrutalistButton
                        text="برگشت به صفحه اصلی"
                        color="yellow-400"
                        textColor="black"
                        onClick={() => navigate("/")}
                        disabled={loading}
                    />
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;