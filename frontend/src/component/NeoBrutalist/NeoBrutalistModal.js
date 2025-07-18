import React, { useEffect } from 'react';
import '../../styles/NeoBrutalistCSS/Modal.css';

const NeoBrutalistModal = ({
                               children,
                               onClose,
                               isOpen = true,
                               title = null,
                               size = 'large',
                               showCloseButton = true,
                               backgroundColor = 'white',
                               borderColor = 'black'
                           }) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClasses = {
        small: 'max-w-md',
        medium: 'max-w-lg',
        large: 'max-w-4xl',
        full: 'max-w-6xl h-full max-h-screen'
    };

    return (
        <div className="neo-modal-overlay" onClick={onClose}>
            <div
                className={`neo-modal-container ${sizeClasses[size] || sizeClasses.large} bg-${backgroundColor} border-${borderColor}`}
                onClick={(e) => e.stopPropagation()}
            >
                {(title || showCloseButton) && (
                    <div className="neo-modal-header">
                        {title && <h2 className="neo-modal-title">{title}</h2>}
                        {showCloseButton && (
                            <button className="neo-modal-close-btn" onClick={onClose} aria-label="Close modal">
                                ×
                            </button>
                        )}
                    </div>
                )}
                <div className={`neo-modal-body ${size === 'full' ? 'h-full overflow-y-auto' : ''}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default NeoBrutalistModal;
