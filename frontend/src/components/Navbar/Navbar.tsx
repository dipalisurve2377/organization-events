import React from "react";
import "./Navbar.css";

const Navbar: React.FC = () => (
  <header className="navbar">
    <div className="navbar-content">
      {/* Left: Overview Title */}
      <div className="navbar-title">Overview</div>

      {/* Center: Search Bar */}
      <div className="navbar-search">
        <svg width="20" height="20" fill="none" className="navbar-search-icon">
          <circle cx="9" cy="9" r="8" stroke="#718DC0" strokeWidth="2" />
          <line
            x1="15"
            y1="15"
            x2="19"
            y2="19"
            stroke="#718DC0"
            strokeWidth="2"
          />
        </svg>
        <input
          type="text"
          placeholder="Search for something"
          className="navbar-search-input"
        />
      </div>

      {/* Right: Notification and Avatar */}
      <div className="navbar-right">
        <div className="navbar-notification">
          <svg width="25" height="25" fill="none">
            <circle cx="12.5" cy="12.5" r="10" fill="#F5F7FA" />
            <path
              d="M12.5 7a5 5 0 0 1 5 5v3h2v2h-14v-2h2v-3a5 5 0 0 1 5-5z"
              fill="#FE5C73"
            />
          </svg>
        </div>
        <div className="navbar-avatar">
          <img
            src="https://randomuser.me/api/portraits/men/32.jpg"
            alt="User"
          />
        </div>
      </div>
    </div>
  </header>
);

export default Navbar;
