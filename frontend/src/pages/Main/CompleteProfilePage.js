import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import NeoBrutalistInput from "../../component/NeoBrutalist/NeoBrutalistInput";
import NeoBrutalistButton from "../../component/NeoBrutalist/NeoBrutalistButton";
import "../../styles/Main/complete-profile.css";

const CompleteProfilePage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const { user, missing_fields, isGoogleUser } = location.state || {};

    const [phone, setPhone] = useState(user?.phone || "");
    const [companyName, setCompanyName] = useState(user?.company_name || "");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Redirect if no user data
    React.useEffect(() => {
        if (!user || !isGoogleUser) {
            navigate("/login");
        }
    }, [user, isGoogleUser, navigate]);

    const handleCompleteProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const profileData = {
                email: user.email,
                phone: phone.trim(),
                company_name: companyName.trim()
            };

            const response = await axios.post(
                `${process.env.REACT_APP_API_URL || '/api/'}auth/google/complete-profile/`,
                profileData,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    withCredentials: true
                }
            );

            if (response.status === 200) {
                const { user: updatedUser, tokens } = response.data;

                // Update stored user data
                localStorage.setItem('userData', JSON.stringify({
                    id: updatedUser.id,
                    email: updatedUser.email,
                    name: updatedUser.name,
                    is_staff: updatedUser.is_staff,
                    is_dealer: updatedUser.is_dealer,
                    company_name: updatedUser.company_name,
                    phone: updatedUser.phone
                }));

                // Update tokens
                localStorage.setItem('access_token', tokens.access);
                localStorage.setItem('refresh_token', tokens.refresh);
                axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.access}`;

                setTimeout(() => {
                    if (updatedUser.is_staff) {
                        navigate("/admin");
                    } else if (updatedUser.is_dealer) {
                        navigate("/dealer");
                    } else {
                        navigate("/dashboard");
                    }
                }, 100);
            }

        } catch (err) {
            console.error("Profile completion error:", err);

            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else if (err.response?.status === 400) {
                setError("اطلاعات وارد شده نامعتبر است");
            } else {
                setError("خطا در تکمیل اطلاعات. لطفاً دوباره تلاش کنید.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSkipForNow = () => {
        // Allow user to skip for now and complete later
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');

        if (userData.is_staff) {
            navigate("/admin");
        } else if (userData.is_dealer) {
            navigate("/dealer");
        } else {
            navigate("/dashboard");
        }
    };

    if (!user) {
        return <div>Loading...</div>;
    }

    return (
        <div className="complete-profile-container">
            <div className="complete-profile-card">
                <h2>تکمیل اطلاعات کاربری</h2>
                <p className="welcome-message">
                    {user.name} عزیز، خوش آمدید! لطفاً اطلاعات زیر را تکمیل کنید:
                </p>

                {error && <p className="error">{error}</p>}

                <form onSubmit={handleCompleteProfile}>
                    <div className="profile-info">
                        <p><strong>ایمیل:</strong> {user.email}</p>
                        <p><strong>نام:</strong> {user.name}</p>
                    </div>

                    {missing_fields?.phone && (
                        <NeoBrutalistInput
                            type="tel"
                            placeholder="شماره تلفن همراه (الزامی)"
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
                    )}

                    {missing_fields?.company_name && (
                        <NeoBrutalistInput
                            type="text"
                            placeholder="نام شرکت (اختیاری)"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            disabled={loading}
                        />
                    )}

                    <div className="button-group">
                        <NeoBrutalistButton
                            text={loading ? "در حال ذخیره..." : "تکمیل اطلاعات"}
                            type="submit"
                            color="green-500"
                            textColor="white"
                            disabled={loading || !phone.trim()}
                        />

                        <NeoBrutalistButton
                            text="بعداً تکمیل کنم"
                            type="button"
                            color="gray-400"
                            textColor="black"
                            onClick={handleSkipForNow}
                            disabled={loading}
                        />
                    </div>
                </form>

                <div className="security-note">
                    <p>🔒 اطلاعات شما به صورت امن ذخیره می‌شود</p>
                </div>
            </div>
        </div>
    );
};

export default CompleteProfilePage;