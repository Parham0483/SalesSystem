import React from 'react';

const NeoBrutalistToggle = ({
                          checked = false,
                          onChange,
                          label = '',
                          disabled = false,
                          size = 'medium', // small, medium, large
                          color = 'blue', // blue, green, red, purple, orange
                          className = '',
                          id
                      }) => {
    const toggleId = id || `toggle-${Math.random().toString(36).substr(2, 9)}`;

    const handleClick = (event) => {
        // Completely prevent any form submission or page behavior
        event.preventDefault();
        event.stopPropagation();

        if (disabled) return;

        if (onChange) {
            // Call onChange with the new checked state
            onChange(!checked);
        }

        return false;
    };

    const handleKeyDown = (event) => {
        if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            handleClick(event);
        }
    };

    // Size configurations
    const sizeConfig = {
        small: {
            track: { width: '32px', height: '18px' },
            knob: { width: '14px', height: '14px' },
            translate: '14px'
        },
        medium: {
            track: { width: '44px', height: '24px' },
            knob: { width: '20px', height: '20px' },
            translate: '20px'
        },
        large: {
            track: { width: '56px', height: '32px' },
            knob: { width: '28px', height: '28px' },
            translate: '24px'
        }
    };

    // Color configurations
    const colorConfig = {
        blue: {
            active: '#3B82F6',
            activeHover: '#2563EB'
        },
        green: {
            active: '#10B981',
            activeHover: '#059669'
        },
        red: {
            active: '#EF4444',
            activeHover: '#DC2626'
        },
        purple: {
            active: '#8B5CF6',
            activeHover: '#7C3AED'
        },
        orange: {
            active: '#F97316',
            activeHover: '#EA580C'
        }
    };

    const currentSize = sizeConfig[size] || sizeConfig.medium;
    const currentColor = colorConfig[color] || colorConfig.blue;

    const trackStyle = {
        width: currentSize.track.width,
        height: currentSize.track.height,
        backgroundColor: checked ? currentColor.active : '#E5E7EB',
        border: '2px solid #000',
        borderRadius: '50px',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        padding: '2px',
        boxShadow: checked ? '0 0 0 2px rgba(59, 130, 246, 0.1)' : 'none',
        opacity: disabled ? 0.5 : 1,
        outline: 'none'
    };

    const knobStyle = {
        width: currentSize.knob.width,
        height: currentSize.knob.height,
        backgroundColor: '#FFFFFF',
        border: '1px solid #D1D5DB',
        borderRadius: '50%',
        position: 'absolute',
        left: checked ? currentSize.translate : '2px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    const containerStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.6 : 1
    };

    const labelStyle = {
        fontSize: size === 'small' ? '13px' : size === 'large' ? '16px' : '14px',
        fontWeight: '500',
        color: disabled ? '#9CA3AF' : '#374151',
        cursor: disabled ? 'not-allowed' : 'pointer'
    };

    return (
        <div
            className={`modern-toggle ${className}`}
            style={containerStyle}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={disabled ? -1 : 0}
            role="switch"
            aria-checked={checked}
            aria-labelledby={label ? `${toggleId}-label` : undefined}
            aria-disabled={disabled}
        >
            <div
                style={trackStyle}
                onMouseEnter={(e) => {
                    if (!disabled && checked) {
                        e.target.style.backgroundColor = currentColor.activeHover;
                    }
                }}
                onMouseLeave={(e) => {
                    if (!disabled && checked) {
                        e.target.style.backgroundColor = currentColor.active;
                    }
                }}
            >
                <div style={knobStyle}>
                    {/* Optional checkmark icon when active */}
                    {checked && (
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            style={{
                                opacity: 0.7,
                                display: size === 'small' ? 'none' : 'block'
                            }}
                        >
                            <path
                                d="M2 6L4.5 8.5L10 3"
                                stroke={currentColor.active}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </div>
            </div>

            {label && (
                <label
                    id={`${toggleId}-label`}
                    style={labelStyle}
                    onClick={handleClick}
                >
                    {label}
                </label>
            )}
        </div>
    );
};

export default NeoBrutalistToggle;