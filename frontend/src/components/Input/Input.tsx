import React from "react";

interface InputProps {
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | "date";
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

const Input: React.FC<InputProps> = ({
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  label,
  className = "",
  style,
}) => {
  return (
    <div className={`form-field ${className}`} style={style}>
      {label && <label className="form-label">{label}</label>}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="form-input"
      />
    </div>
  );
};

export default Input;
