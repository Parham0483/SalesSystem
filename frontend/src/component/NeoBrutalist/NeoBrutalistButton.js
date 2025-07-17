import React from 'react';
import '../../styles/NeoBrutalistCSS/Button.css';

const NeoBrutalistButton = ({
                    text = 'Click Me',
                    color = 'yellow-400',
                    textColor = 'black',
                    onClick,
                    className = '',
                    ...props
                }) => {
    return (
        <button
            className={`neo-brutalist-btn ${className}`}
            style={{
                backgroundColor: `var(--${color})`,
                color: textColor
            }}
            onClick={onClick}
            {...props}
        >
            {text}
        </button>
    );
};

export default NeoBrutalistButton;