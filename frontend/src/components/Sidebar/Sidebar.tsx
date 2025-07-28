import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Sidebar.css";

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isUsersActive = location.pathname === "/";
  const isOrganizationsActive = location.pathname === "/organizations";

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img
          src="https://platformatory.io/blog/assets/images/plf-logo.svg"
          alt="Platformatory Logo"
          className="sidebar-logo-img"
        />
      </div>
      <hr className="sidebar-divider" />
      {/* Users Nav Item */}
      <div
        className={`sidebar-nav-item ${isUsersActive ? "active" : ""}`}
        onClick={() => navigate("/")}
        style={{ cursor: "pointer" }}
      >
        {isUsersActive && <div className="sidebar-active-bar" />}
        <div className="sidebar-nav-icon">
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
            <path
              d="M12.5 12.5C15.8137 12.5 18.5 9.81371 18.5 6.5C18.5 3.18629 15.8137 0.5 12.5 0.5C9.18629 0.5 6.5 3.18629 6.5 6.5C6.5 9.81371 9.18629 12.5 12.5 12.5Z"
              fill={isUsersActive ? "#3960FF" : "#B1B1B1"}
            />
            <path
              d="M2.5 24.5C2.5 19.5294 7.02944 15.5 12.5 15.5C17.9706 15.5 22.5 19.5294 22.5 24.5H2.5Z"
              fill={isUsersActive ? "#3960FF" : "#B1B1B1"}
            />
          </svg>
        </div>
        <span
          className={`sidebar-nav-label ${!isUsersActive ? "inactive" : ""}`}
        >
          Users
        </span>
      </div>
      {/* Organizations Nav Item */}
      <div
        className={`sidebar-nav-item ${isOrganizationsActive ? "active" : ""}`}
        onClick={() => navigate("/organizations")}
        style={{ cursor: "pointer" }}
      >
        {isOrganizationsActive && <div className="sidebar-active-bar" />}
        <div className="sidebar-nav-icon">
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
            <rect
              x="2"
              y="7"
              width="21"
              height="15"
              rx="3"
              fill={isOrganizationsActive ? "#3960FF" : "#B1B1B1"}
            />
            <rect
              x="7"
              y="2"
              width="11"
              height="7"
              rx="2"
              fill={isOrganizationsActive ? "#3960FF" : "#B1B1B1"}
            />
          </svg>
        </div>
        <span
          className={`sidebar-nav-label ${
            !isOrganizationsActive ? "inactive" : ""
          }`}
        >
          Organizations
        </span>
      </div>
    </aside>
  );
};

export default Sidebar;
