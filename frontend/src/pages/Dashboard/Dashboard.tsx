import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Link } from "react-router-dom";
import Button from "../../components/Button/Button";

const Dashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth0();

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <h2>Please log in to access the dashboard</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
          Welcome back, {user?.name || user?.email}!
        </h1>
        <p style={{ color: "#666", fontSize: "1.1rem" }}>
          Manage your users and organizations from this dashboard.
        </p>
      </div>

      {/* Quick Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#374151" }}>Users</h3>
          <p
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              margin: "0",
              color: "#3B82F6",
            }}
          >
            0
          </p>
          <p style={{ margin: "0.5rem 0 0 0", color: "#6B7280" }}>
            Total registered users
          </p>
        </div>

        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#374151" }}>
            Organizations
          </h3>
          <p
            style={{
              fontSize: "2rem",
              fontWeight: "bold",
              margin: "0",
              color: "#10B981",
            }}
          >
            0
          </p>
          <p style={{ margin: "0.5rem 0 0 0", color: "#6B7280" }}>
            Total organizations
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Quick Actions</h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link to="/create-user" style={{ textDecoration: "none" }}>
            <Button variant="primary" size="large">
              Create New User
            </Button>
          </Link>
          <Link to="/organizations/create" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="large">
              Create Organization
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h3 style={{ margin: "0 0 1rem 0", color: "#374151" }}>
            User Management
          </h3>
          <p style={{ color: "#6B7280", marginBottom: "1.5rem" }}>
            Create, view, update, and delete user accounts. Manage user
            permissions and profiles.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link to="/" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="medium">
                View Users
              </Button>
            </Link>
            <Link to="/create-user" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="medium">
                Add User
              </Button>
            </Link>
          </div>
        </div>

        <div
          style={{
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h3 style={{ margin: "0 0 1rem 0", color: "#374151" }}>
            Organization Management
          </h3>
          <p style={{ color: "#6B7280", marginBottom: "1.5rem" }}>
            Manage organizations, their settings, and member associations.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Link to="/organizations" style={{ textDecoration: "none" }}>
              <Button variant="primary" size="medium">
                View Organizations
              </Button>
            </Link>
            <Link to="/organizations/create" style={{ textDecoration: "none" }}>
              <Button variant="secondary" size="medium">
                Add Organization
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
