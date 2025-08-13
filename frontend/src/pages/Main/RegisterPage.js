import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import NeoBrutalistInput from "../../component/NeoBrutalist/NeoBrutalistInput";
import NeoBrutalistButton from "../../component/NeoBrutalist/NeoBrutalistButton";
import GoogleLoginButton from "../../component/GoogleAuth/GoogleLoginButton";
import "../../styles/Main/register.css";

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


        try {
            const registrationData = {
                email,
                name,
                password,
                phone,
                company_name: companyName,
            };

            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || '/api/'}auth/register/`,
                registrationData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true
                }
            );


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

    const handleGoogleSuccess = (user) => {
        // Navigation is handled in GoogleLoginButton component
    };

    const handleGoogleError = (errorMessage) => {
        setError(errorMessage);
    };

    return (
        <div className="register-container">
            <div className="register-card">
                <h2>سامانه ثبت سفارش</h2>
                {error && <p className="error">{error}</p>}



                {/* Regular Registration Form */}
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
                        text={loading ? "" : "ثبت نام"}
                        type="submit"
                        color="yellow-400"
                        textColor="black"
                        className="register-submit-btn"
                        disabled={loading}
                    />
                </form>

                {/* Google Registration Section */}
                <div className="google-register-section">
                    <div className="register-divider">
                        <span>ثبت نام سریع با گوگل</span>
                    </div>

                    <GoogleLoginButton
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                    />
                </div>
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
    );
};

export default RegisterPage;