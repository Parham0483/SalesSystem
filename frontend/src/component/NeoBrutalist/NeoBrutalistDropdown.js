import React, { useState, useRef, useEffect } from 'react';
import '../../styles/NeoBrutalistCSS/DropDown.css';

const NeoBrutalistDropdown = ({
                                  label = "Select Option",
                                  options = [],
                                  value = "",
                                  onChange,
                                  placeholder = "Choose an option...",
                                  required = false,
                                  disabled = false,
                                  className = "",
                                  error = false,
                                  name = ""
                              }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(option => option.value === value);
    const displayText = selectedOption ? selectedOption.label : placeholder;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    const handleOptionClick = (option) => {
        if (onChange) {
            onChange(option.value, option);
        }
        setIsOpen(false);
    };

    return (
        <div className={`neo-dropdown-container ${className}`} ref={dropdownRef}>
            {label && (
                <label className="neo-dropdown-label">
                    {label}
                    {required && <span className="neo-required">*</span>}
                </label>
            )}
            <div className={`neo-dropdown ${isOpen ? 'open' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''}`}>
                <button
                    type="button"
                    className="neo-dropdown-trigger"
                    onClick={handleToggle}
                    disabled={disabled}
                    name={name}
                >
                    <span className={`neo-dropdown-text ${!selectedOption ? 'placeholder' : ''}`}>
                        {displayText}
                    </span>
                    <svg
                        className={`neo-dropdown-arrow ${isOpen ? 'rotated' : ''}`}
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                    >
                        <path
                            d="M2 4L6 8L10 4"
                            stroke="currentColor"
                            strokeWidth="3"
                            fill="none"
                            strokeLinecap="square"
                        />
                    </svg>
                </button>

                {isOpen && (
                    <ul className="neo-dropdown-menu">
                        {options.map((option, index) => (
                            <li
                                key={option.value || index}
                                className={`neo-dropdown-option ${option.value === value ? 'selected' : ''}`}
                                onClick={() => handleOptionClick(option)}
                            >
                                {option.label}
                            </li>
                        ))}
                        {options.length === 0 && (
                            <li className="neo-dropdown-option disabled">
                                No options available
                            </li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default NeoBrutalistDropdown;