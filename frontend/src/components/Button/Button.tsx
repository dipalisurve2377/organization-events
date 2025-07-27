import React from "react";

interface ButtonProps {
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  style?: React.CSSProperties;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "medium",
  children,
  onClick,
  disabled = false,
  type = "button",
  className = "",
  style,
}) => {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.2s ease-in-out",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    ...style,
  };

  const variantStyles = {
    primary: {
      backgroundColor: disabled ? "#E5E7EB" : "#3B82F6",
      color: "#FFFFFF",
    },
    secondary: {
      backgroundColor: disabled ? "#F3F4F6" : "#FFFFFF",
      color: disabled ? "#9CA3AF" : "#374151",
      border: "1px solid #D1D5DB",
    },
    danger: {
      backgroundColor: disabled ? "#FEE2E2" : "#EF4444",
      color: "#FFFFFF",
    },
  };

  const sizeStyles = {
    small: {
      padding: "8px 16px",
      fontSize: "14px",
      minHeight: "36px",
    },
    medium: {
      padding: "12px 20px",
      fontSize: "16px",
      minHeight: "44px",
    },
    large: {
      padding: "16px 24px",
      fontSize: "18px",
      minHeight: "52px",
    },
  };

  const getButtonStyles = (): React.CSSProperties => {
    const variantStyle = variantStyles[variant];
    const sizeStyle = sizeStyles[size];

    const styles: React.CSSProperties = {
      ...baseStyles,
      ...sizeStyle,
      backgroundColor: variantStyle.backgroundColor,
      color: variantStyle.color,
      opacity: disabled ? 0.6 : 1,
    };

    // Add border only for secondary variant
    if (variant === "secondary") {
      styles.border = "1px solid #D1D5DB";
    }

    return styles;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!disabled && onClick) {
      onClick();
    }
  };

  return (
    <button
      type={type}
      className={`button button--${variant} button--${size} ${className}`}
      style={getButtonStyles()}
      onClick={handleClick}
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {children}
    </button>
  );
};

export default Button;
