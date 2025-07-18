import React from "react";
import { useNavigate } from "react-router-dom";
import NeoBrutalistButton from "../component/NeoBrutalist/NeoBrutalistButton.js";
import UnicornScene from "unicornstudio-react";
import "../styles/MainPage.css";

const MainPage = () => {
    const navigate = useNavigate();

    return (
        <div className="page-wrapper">

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