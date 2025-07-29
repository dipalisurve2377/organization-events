import React from "react";
import "./Form.css";

interface FormProps {
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  title?: string;
  loading?: boolean;
  error?: string | null;
  success?: string | null;
  submitButtonText?: string;
  submitButtonDisabled?: boolean;
  showSubmitButton?: boolean;
  variant?: "primary" | "secondary";
  size?: "small" | "medium" | "large";
  className?: string;
  style?: React.CSSProperties;
}

const Form: React.FC<FormProps> = ({
  onSubmit,
  children,
  title,
  loading = false,
  error = null,
  success = null,
  submitButtonText = "Submit",
  submitButtonDisabled = false,
  showSubmitButton = true,
  variant = "primary",
  size = "medium",
  className = "",
  style,
}) => {
  const containerClass = `form-container form-${variant} form-${size} ${className}`;

  return (
    <div className={containerClass} style={style}>
      {title && <div className="form-tab">{title}</div>}
      <form onSubmit={onSubmit} className="form-form">
        <div className="form-form-content">{children}</div>

        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}

        {showSubmitButton && (
          <div className="form-button-container">
            <button
              type="submit"
              disabled={loading || submitButtonDisabled}
              className="form-submit-btn"
            >
              {loading ? "Submitting..." : submitButtonText}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default Form;
