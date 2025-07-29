import React from "react";

interface FormColumnProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const FormColumn: React.FC<FormColumnProps> = ({
  children,
  className = "",
  style,
}) => {
  return (
    <div className={`form-column ${className}`} style={style}>
      {children}
    </div>
  );
};

export default FormColumn;
