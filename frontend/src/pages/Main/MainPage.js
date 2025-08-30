import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NeoBrutalistButton from "../../component/NeoBrutalist/NeoBrutalistButton.js";
import "../../styles/Main/MainPage.css";



const MainPage = () => {
    const navigate = useNavigate();
    const [showUnicorn, setShowUnicorn] = useState(true);
    const [UnicornScene, setUnicornScene] = useState(null);

    useEffect(() => {
        try {
            // Try to import UnicornScene
            const UnicornSceneComponent = require("unicornstudio-react").default;
            setUnicornScene(() => UnicornSceneComponent);
        } catch (error) {
            console.log("UnicornScene not available:", error);
            setShowUnicorn(false);
        }
    }, []);

    // Hide unicorn scene if it errors out
    useEffect(() => {
        const hideUnicornErrors = () => {
            const errorElements = document.querySelectorAll('[style*="background-color: rgb(254, 242, 242)"]');
            errorElements.forEach(element => {
                element.style.display = 'none';
            });
        };

        // Check for error messages periodically
        const interval = setInterval(hideUnicornErrors, 100);

        // Clean up after 5 seconds
        setTimeout(() => {
            clearInterval(interval);
            setShowUnicorn(false);
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="page-wrapper">
            {/* Add CSS to hide unicorn error messages */}
            <style>
                {`
                    div[style*="background-color: rgb(254, 242, 242)"] {
                        display: none !important;
                    }
                    div[style*="color: rgb(239, 68, 68)"] {
                        display: none !important;
                    }
                `}
            </style>

            {showUnicorn && UnicornScene && (
                <UnicornScene
                    projectId="9LavQqV4nq9siFdVEwmk"
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        zIndex: 0,
                    }}
                />
            )}

            <div className="main-container">
                <div className="main-box">
                    <h2 className="main-title">سامانه ثبت سفارش</h2>
                    <div className="button-group">
                        <NeoBrutalistButton
                            text="ورود"
                            className="login-btn"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => navigate("/login")}
                        />
                        <NeoBrutalistButton
                            text="ثبت نام"
                            className="register-btn"
                            color="yellow-400"
                            textColor="black"
                            onClick={() => navigate("/register")}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MainPage;