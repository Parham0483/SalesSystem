import React from "react";
import { useNavigate } from "react-router-dom";

const MainPage = () => {
    const navigate = useNavigate();

    return (
        <div className="main-container" id="mainPageContainer">
            <h2 className="main-title" id="mainTitle">Welcome</h2>
            <button
                className="main-btn login-btn"
                id="loginButton"
                onClick={() => navigate("/login")}
            >
                Login
            </button>
            <button
                className="main-btn register-btn"
                id="registerButton"
                onClick={() => navigate("/register")}
            >
                Register
            </button>
        </div>
    );
};

export default MainPage;
