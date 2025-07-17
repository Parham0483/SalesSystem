import React from "react";
import { useNavigate } from "react-router-dom";
import NeoBrutalistButton from "../component/NeoBrutalist/NeoBrutalistButton.js";
import "../styles/MainPage.css";

const MainPage = () => {
    const navigate = useNavigate();

    return (
        <div className="main-container" id="mainPageContainer">
            <div className="main-box">
                <h2 className="main-title" id="mainTitle">سامانه ثبت سفارش</h2>

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
    );
};

export default MainPage;