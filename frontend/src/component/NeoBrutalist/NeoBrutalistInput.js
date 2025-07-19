import React from "react";
import '../../styles/NeoBrutalistCSS/Input.css';

const NeoBrutalistInput = ({
                               type='text',
                               placeholder='Enter text ..',
                               value,
                               onChange,
                               className="",
                               ...props
                           }) => {
    return (
        <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className={`neo-brutalist-input ${className}`}
            {...props}
        />
    )
};

export default NeoBrutalistInput;