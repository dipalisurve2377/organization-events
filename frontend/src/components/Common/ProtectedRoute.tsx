import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Button from "../Button/Button";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loginWithRedirect, isLoading } = useAuth0();

  const handleLogin = () => {
    loginWithRedirect();
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
        <div style={{ fontSize: "18px", color: "#666", marginBottom: "20px" }}>
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "3rem",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
            textAlign: "center",
            maxWidth: "400px",
            width: "90%",
          }}
        >
          <div
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              color: "#344c6b",
              marginBottom: "1rem",
            }}
          >
            Welcome
          </div>
          <div
            style={{
              fontSize: "1.1rem",
              color: "#666",
              marginBottom: "2rem",
              lineHeight: "1.6",
            }}
          >
            Please log in to access the user management dashboard and manage
            your organization's users and settings.
          </div>
          <Button
            variant="primary"
            size="large"
            onClick={handleLogin}
            style={{ width: "100%" }}
          >
            Sign In to Continue
          </Button>
          <div
            style={{
              fontSize: "0.9rem",
              color: "#999",
              marginTop: "1.5rem",
            }}
          >
            Secure authentication powered by Auth0
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
