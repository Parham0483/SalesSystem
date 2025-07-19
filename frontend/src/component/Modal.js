import React from 'react';
import '../styles/CreateOrder.css';

const Modal = ({ children, onClose }) => {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="modal-close" onClick={onClose}>
                    ×
                </button>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;