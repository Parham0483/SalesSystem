import React from 'react';
import '../../styles/NeoBrutalistCSS/modal.css';

const NeoBrutalistModal = ({
                               isOpen,
                               onClose,
                               title = "Modal Title",
                               children,
                               className = "",
                               size = "medium",
                               zIndex = 1000
                           }) => {
    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="neo-modal-overlay" onClick={handleOverlayClick} style={{zIndex}}>
            <div className={`neo-modal ${size} ${className}`}>
                <div className="neo-modal-header">
                    <h2 className="neo-modal-title">{title}</h2>
                    <button
                        className="neo-modal-close"
                        onClick={onClose}
                        type="button"
                    >
                        ×
                    </button>
                </div>
                <div className="neo-modal-content">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default NeoBrutalistModal;