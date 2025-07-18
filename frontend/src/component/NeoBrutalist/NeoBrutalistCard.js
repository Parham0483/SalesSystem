import React from 'react';
import '../../styles/NeoBrutalistCSS/card.css';

const NeoBrutalistCard = ({
                              children,
                              className = '',
                              onClick,
                              title,
                              content,
                              ...props
                          }) => {
    return (
        <div
            className={`neo-brutalist-card ${className}`}
            onClick={onClick}
            {...props}
        >
            {title && <h3 className="card-title">{title}</h3>}
            {content && <p className="card-content">{content}</p>}
            {children}
        </div>
    );
};

export default NeoBrutalistCard;