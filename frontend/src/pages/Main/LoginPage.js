import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import NeoBrutalistInput from "../../component/NeoBrutalist/NeoBrutalistInput";
import NeoBrutalistButton from "../../component/NeoBrutalist/NeoBrutalistButton";
import GoogleLoginButton from "../../component/GoogleAuth/GoogleLoginButton";
import "../../styles/Main/login.css";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [resetStep, setResetStep] = useState('request');
    const [resetEmail, setResetEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [resetMessage, setResetMessage] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const loginData = { email, password };

            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || '/api/'}auth/login/`,
                loginData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true
                }
            );

            if (response.status === 200) {
                const { user, tokens } = response.data;

                localStorage.setItem('userData', JSON.stringify({
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    is_staff: user.is_staff,
                    is_dealer: user.is_dealer,
                    company_name: user.company_name,
                    phone: user.phone
                }));

                localStorage.setItem('access_token', tokens.access);
                localStorage.setItem('refresh_token', tokens.refresh);

                axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.access}`;

                setTimeout(() => {
                    if (user.is_staff) {
                        navigate("/admin");
                    } else if (user.is_dealer) {
                        navigate("/dealer");
                    } else {
                        navigate("/dashboard");
                    }
                }, 100);
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

            localStorage.removeItem('userData');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            delete axios.defaults.headers.common['Authorization'];
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordResetRequest = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setResetMessage("");

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || '/api/'}auth/password-reset/request/`,
                { email: resetEmail },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (response.status === 200) {
                setResetMessage("کد بازیابی به ایمیل و شماره تماس شما ارسال شد");
                setResetStep('verify');
            }

        } catch (err) {
            console.error("Password reset request error:", err);
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError("خطا در ارسال کد بازیابی. لطفاً دوباره تلاش کنید.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOtpVerification = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setResetMessage("");

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || '/api/'}auth/password-reset/verify/`,
                {
                    email: resetEmail,
                    otp: otp
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (response.status === 200) {
                setResetToken(response.data.reset_token);
                setResetMessage("کد تایید شد. لطفاً رمز عبور جدید را وارد کنید");
                setResetStep('reset');
            }

        } catch (err) {
            console.error("OTP verification error:", err);
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError("کد وارد شده اشتباه یا منقضی شده است");
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setResetMessage("");

        if (newPassword !== confirmPassword) {
            setError("رمزهای عبور وارد شده یکسان نیستند");
            setLoading(false);
            return;
        }

        if (newPassword.length < 8) {
            setError("رمز عبور باید حداقل ۸ کاراکتر باشد");
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || '/api/'}auth/password-reset/complete/`,
                {
                    email: resetEmail,
                    reset_token: resetToken,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    }
                }
            );

            if (response.status === 200) {
                setResetMessage("رمز عبور با موفقیت تغییر یافت. می‌توانید وارد شوید");
                setTimeout(() => {
                    resetPasswordResetForm();
                }, 2000);
            }

        } catch (err) {
            console.error("Password reset error:", err);
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError("خطا در تغییر رمز عبور. لطفاً دوباره تلاش کنید.");
            }
        } finally {
            setLoading(false);
        }
    };

    const resetPasswordResetForm = () => {
        setShowPasswordReset(false);
        setResetStep('request');
        setResetEmail("");
        setOtp("");
        setResetToken("");
        setNewPassword("");
        setConfirmPassword("");
        setError("");
        setResetMessage("");
    };

    const handleGoogleSuccess = (user) => {
        // Navigation is handled in GoogleLoginButton component
    };

    const handleGoogleError = (errorMessage) => {
        setError(errorMessage);
    };

    // Step indicator component
    const StepIndicator = ({ currentStep }) => {
        const steps = [
            { key: 'request', label: 'درخواست' },
            { key: 'verify', label: 'تایید کد' },
            { key: 'reset', label: 'تغییر رمز' }
        ];

        return (
            <div className="reset-step-indicator">
                {steps.map((step, index) => (
                    <div
                        key={step.key}
                        className={`reset-step ${
                            step.key === currentStep ? 'active' :
                                steps.findIndex(s => s.key === currentStep) > index ? 'completed' : ''
                        }`}
                    >
                        {step.label}
                    </div>
                ))}
            </div>
        );
    };

    if (showPasswordReset) {
        return (
            <div className="login-container" id="loginPageContainer">
                <div className="login-box">
                    <h2 className="login-title">بازیابی رمز عبور</h2>

                    <StepIndicator currentStep={resetStep} />

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    {resetMessage && (
                        <div className="success-message">
                            {resetMessage}
                        </div>
                    )}

                    {resetStep === 'request' && (
                        <form onSubmit={handlePasswordResetRequest} className="password-reset-form">
                            <div className="input-group">
                                <NeoBrutalistInput
                                    type="email"
                                    placeholder="ایمیل خود را وارد کنید"
                                    required
                                    value={resetEmail}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div className="button-group">
                                <NeoBrutalistButton
                                    text={loading ? "در حال ارسال..." : "ارسال کد بازیابی"}
                                    color="yellow-400"
                                    textColor="black"
                                    type="submit"
                                    disabled={loading}
                                />
                            </div>
                        </form>
                    )}

                    {resetStep === 'verify' && (
                        <form onSubmit={handleOtpVerification} className="password-reset-form">
                            <div className="input-group">
                                <NeoBrutalistInput
                                    type="text"
                                    placeholder="کد ۶ رقمی ارسال شده را وارد کنید"
                                    required
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    disabled={loading}
                                    maxLength={6}
                                />
                            </div>
                            <div className="button-group">
                                <NeoBrutalistButton
                                    text={loading ? "در حال بررسی..." : "تایید کد"}
                                    color="yellow-400"
                                    textColor="black"
                                    type="submit"
                                    disabled={loading}
                                />
                            </div>
                        </form>
                    )}

                    {resetStep === 'reset' && (
                        <form onSubmit={handlePasswordReset} className="password-reset-form">
                            <div className="input-group">
                                <NeoBrutalistInput
                                    type="password"
                                    placeholder="رمز عبور جدید (حداقل ۸ کاراکتر)"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div className="input-group">
                                <NeoBrutalistInput
                                    type="password"
                                    placeholder="تکرار رمز عبور جدید"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            <div className="button-group">
                                <NeoBrutalistButton
                                    text={loading ? "در حال ذخیره..." : "تغییر رمز عبور"}
                                    color="yellow-400"
                                    textColor="black"
                                    type="submit"
                                    disabled={loading}
                                />
                            </div>
                        </form>
                    )}

                    <div className="login-footer">
                        <NeoBrutalistButton
                            text="بازگشت به صفحه ورود"
                            color="gray-400"
                            textColor="black"
                            onClick={resetPasswordResetForm}
                            disabled={loading}
                        />
                    </div>
                </div>
            </div>
        );
    }

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

                    {/* Simple forgot password link */}
                    <span
                        className="forgot-password-link"
                        onClick={() => setShowPasswordReset(true)}
                        tabIndex={0}
                        onKeyPress={(e) => e.key === 'Enter' && setShowPasswordReset(true)}
                    >
                        فراموشی رمز عبور؟
                    </span>

                    <div className="button-group">
                        <NeoBrutalistButton
                            text={loading ? "" : "ورود"}
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

                    <div className="google-login-section">
                        <div className="login-divider">
                            <span>ورود سریع با گوگل</span>
                        </div>
                        <GoogleLoginButton
                            onSuccess={handleGoogleSuccess}
                            onError={handleGoogleError}
                            className="google-login-button"
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
        </div>
    );
};

export default LoginPage;