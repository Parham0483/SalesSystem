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
    const [validationErrors, setValidationErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Validation functions
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) return "آدرس ایمیل الزامی است";
        if (!emailRegex.test(email)) return "فرمت ایمیل نامعتبر است";
        return "";
    };

    const validateName = (name) => {
        if (!name) return "نام و نام خانوادگی الزامی است";
        if (name.length < 2) return "نام باید حداقل ۲ کاراکتر باشد";
        if (name.length > 50) return "نام نباید بیش از ۵۰ کاراکتر باشد";
        return "";
    };

    const validatePassword = (password) => {
        const errors = [];

        if (!password) {
            return "پسورد الزامی است";
        }

        if (password.length < 8) {
            errors.push("حداقل ۸ کاراکتر");
        }

        if (!/(?=.*[a-zA-Z])/.test(password)) {
            errors.push("حداقل یک حرف انگلیسی");
        }

        if (!/(?=.*\d)/.test(password)) {
            errors.push("حداقل یک عدد");
        }

        if (errors.length > 0) {
            return `پسورد باید شامل: ${errors.join("، ")} باشد`;
        }

        return "";
    };

    const validatePhone = (phone) => {
        if (!phone) return "شماره تلفن الزامی است";
        if (!/^\d+$/.test(phone)) return "شماره تلفن فقط باید شامل اعداد باشد";
        if (phone.length < 10) return "شماره تلفن باید حداقل ۱۰ رقم باشد";
        if (phone.length > 13) return "شماره تلفن نباید بیش از ۱۳ رقم باشد";

        // Check Iranian phone number patterns
        if (phone.startsWith('09') && phone.length !== 11) {
            return "شماره موبایل ایرانی باید ۱۱ رقم باشد";
        }

        return "";
    };

    const validateCompanyName = (companyName) => {
        if (companyName && companyName.length > 100) {
            return "نام شرکت نباید بیش از ۱۰۰ کاراکتر باشد";
        }
        return "";
    };

    // Real-time validation
    const validateField = (fieldName, value) => {
        let error = "";

        switch (fieldName) {
            case 'email':
                error = validateEmail(value);
                break;
            case 'name':
                error = validateName(value);
                break;
            case 'password':
                error = validatePassword(value);
                break;
            case 'phone':
                error = validatePhone(value);
                break;
            case 'companyName':
                error = validateCompanyName(value);
                break;
            default:
                break;
        }

        setValidationErrors(prev => ({
            ...prev,
            [fieldName]: error
        }));
    };

    // Validate all fields before submission
    const validateAllFields = () => {
        const errors = {
            email: validateEmail(email),
            name: validateName(name),
            password: validatePassword(password),
            phone: validatePhone(phone),
            companyName: validateCompanyName(companyName)
        };

        setValidationErrors(errors);

        // Return true if no errors
        return !Object.values(errors).some(error => error !== "");
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // Validate all fields first
        if (!validateAllFields()) {
            setError("لطفاً خطاهای فرم را اصلاح کنید");
            setLoading(false);
            return;
        }

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
            console.error("Registration error:", err);

            if (err.response?.data?.error) {
                // Handle specific server errors
                const serverError = err.response.data.error;
                if (serverError.includes('email already exists') || serverError.includes('User with this email already exists')) {
                    setValidationErrors(prev => ({
                        ...prev,
                        email: "این ایمیل قبلاً ثبت شده است"
                    }));
                    setError("این ایمیل قبلاً در سیستم موجود است");
                } else {
                    setError(serverError);
                }
            } else if (err.response?.data?.details) {
                // Handle validation errors from server
                const details = err.response.data.details;
                const newValidationErrors = {};

                Object.keys(details).forEach(field => {
                    const fieldErrors = details[field];
                    if (Array.isArray(fieldErrors)) {
                        newValidationErrors[field] = fieldErrors.join(', ');
                    } else {
                        newValidationErrors[field] = fieldErrors;
                    }
                });

                setValidationErrors(prev => ({
                    ...prev,
                    ...newValidationErrors
                }));

                const errorMessages = Object.values(details).flat();
                setError(`خطاهای اعتبارسنجی: ${errorMessages.join(', ')}`);
            } else if (err.response?.status === 400) {
                setError("خطا در اطلاعات وارد شده. لطفاً دوباره بررسی کنید.");
            } else if (err.response?.status === 500) {
                setError("خطای سرور. لطفاً بعداً تلاش کنید.");
            } else if (err.code === 'NETWORK_ERROR') {
                setError("خطای اتصال. لطفاً اتصال اینترنت خود را بررسی کنید.");
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

    // Field change handlers with validation
    const handleEmailChange = (e) => {
        const value = e.target.value;
        setEmail(value);
        validateField('email', value);
    };

    const handleNameChange = (e) => {
        const value = e.target.value;
        setName(value);
        validateField('name', value);
    };

    const handlePasswordChange = (e) => {
        const value = e.target.value;
        setPassword(value);
        validateField('password', value);
    };

    const handlePhoneChange = (e) => {
        const value = e.target.value;
        // Allow only digits
        if (/^\d*$/.test(value)) {
            setPhone(value);
            validateField('phone', value);
        }
    };

    const handleCompanyNameChange = (e) => {
        const value = e.target.value;
        setCompanyName(value);
        validateField('companyName', value);
    };

    return (
        <div className="register-container">
            <div className="register-card">
                <h2>سامانه ثبت سفارش</h2>
                {error && <p className="error">{error}</p>}

                {/* Regular Registration Form */}
                <form onSubmit={handleRegister}>
                    <div className="input-group">
                        <NeoBrutalistInput
                            type="email"
                            placeholder="آدرس ایمیل"
                            value={email}
                            onChange={handleEmailChange}
                            required
                            disabled={loading}
                            className={validationErrors.email ? 'input-error' : ''}
                        />
                        {validationErrors.email && (
                            <p className="field-error">{validationErrors.email}</p>
                        )}
                    </div>

                    <div className="input-group">
                        <NeoBrutalistInput
                            type="text"
                            placeholder="نام و نام خانوادگی"
                            value={name}
                            onChange={handleNameChange}
                            required
                            disabled={loading}
                            className={validationErrors.name ? 'input-error' : ''}
                        />
                        {validationErrors.name && (
                            <p className="field-error">{validationErrors.name}</p>
                        )}
                    </div>

                    <div className="input-group">
                        <NeoBrutalistInput
                            type="password"
                            placeholder="پسورد"
                            value={password}
                            onChange={handlePasswordChange}
                            required
                            minLength={8}
                            disabled={loading}
                            className={validationErrors.password ? 'input-error' : ''}
                        />
                        {validationErrors.password && (
                            <p className="field-error">{validationErrors.password}</p>
                        )}
                        {password && !validationErrors.password && (
                            <p className="field-success">پسورد معتبر است ✓</p>
                        )}
                    </div>

                    <div className="input-group">
                        <NeoBrutalistInput
                            type="tel"
                            placeholder="شماره تلفن همراه"
                            value={phone}
                            onChange={handlePhoneChange}
                            required
                            disabled={loading}
                            className={validationErrors.phone ? 'input-error' : ''}
                        />
                        {validationErrors.phone && (
                            <p className="field-error">{validationErrors.phone}</p>
                        )}
                        {phone && !validationErrors.phone && phone.length >= 10 && (
                            <p className="field-success">شماره تلفن معتبر است ✓</p>
                        )}
                    </div>

                    <div className="input-group">
                        <NeoBrutalistInput
                            type="text"
                            placeholder="نام شرکت (اختیاری)"
                            value={companyName}
                            onChange={handleCompanyNameChange}
                            disabled={loading}
                            className={validationErrors.companyName ? 'input-error' : ''}
                        />
                        {validationErrors.companyName && (
                            <p className="field-error">{validationErrors.companyName}</p>
                        )}
                    </div>

                    <NeoBrutalistButton
                        text={loading ? "در حال ثبت نام..." : "ثبت نام"}
                        type="submit"
                        color="yellow-400"
                        textColor="black"
                        className="register-submit-btn"
                        disabled={loading || Object.values(validationErrors).some(error => error !== "")}
                    />
                </form>


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