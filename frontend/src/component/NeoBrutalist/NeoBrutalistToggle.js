import React from 'react';
import '../../styles/NeoBrutalistCSS/toggle.css'

const NeoBrutalistToggle = ({ checked, onChange, label, className = '' }) => {
    // Generate a unique ID for the input and label association for accessibility
    const uniqueId = React.useId();

    return (
        <label htmlFor={uniqueId} className={`neo-brutalist-toggle ${className}`}>
            <input
                id={uniqueId}
                type="checkbox"
                className="toggle-input"
                checked={checked}
                onChange={onChange}
            />
            <div className="toggle-track">
                <div className="toggle-knob"></div>
            </div>
            {label && <span className="toggle-label">{label}</span>}
        </label>
    );
};

export default NeoBrutalistToggle;
