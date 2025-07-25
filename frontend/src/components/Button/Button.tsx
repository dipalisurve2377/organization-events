// src/components/Button/Button.tsx
import React from "react";

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
};

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  type = "button",
  disabled = false,
  className = "",
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`custom-figma-btn ${className}`}
      style={{
        background: "#1814F3",
        color: "#FFF",
        border: "none",
        borderRadius: 9,
        width: 120,
        height: 40,
        fontSize: 16,
        fontWeight: 500,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.6 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {children}
    </button>
  );
};

export default Button;
