import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import "./Navbar.css";
import { useSearchContext } from "../SearchBar/SearchContext";
import settingsIcon from "../../assets/settings.png";
import notificationBellIcon from "../../assets/notification-bell.png";
// import Loader from "../Loader/Loader";

const Navbar: React.FC = () => {
  const { isAuthenticated, loginWithRedirect, logout, user, isLoading } =
    useAuth0();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { searchTerm, setSearchTerm } = useSearchContext();

  const handleLogin = () => {
    loginWithRedirect();
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
    setShowUserDropdown(false);
  };

  const toggleUserDropdown = () => {
    setShowUserDropdown(!showUserDropdown);
  };

  if (isLoading) {
    return (
      <header className="navbar">
        <div className="navbar-content">
          <div
            style={{ width: "100%", display: "flex", justifyContent: "center" }}
          >
            {/* <Loader /> */}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="navbar">
      <div className="navbar-content">
        {/* Overview title positioned at x: 290, y: 33 */}
        <div className="navbar-title">Overview</div>

        {/* Search bar group positioned at x: 890, y: 25, width: 255, height: 50 */}
        <div className="navbar-search">
          {/* Magnifying glass positioned at x: 915, y: 40, width: 20, height: 20 */}
          <svg
            width="20"
            height="20"
            fill="none"
            className="navbar-search-icon"
          >
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
          {/* Search text positioned at x: 950, y: 41 */}
          <input
            type="text"
            placeholder="Search for something"
            className="navbar-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Right side icons and profile */}
        <div className="navbar-right">
          {/* Settings icon group positioned at x: 1175, y: 25, width: 50, height: 50 */}
          <div className="navbar-icon">
            <img
              src={settingsIcon}
              alt="Settings"
              className="navbar-icon-img"
            />
          </div>

          {/* Notification icon group positioned at x: 1255, y: 25, width: 50, height: 50 */}
          <div className="navbar-notification">
            <img
              src={notificationBellIcon}
              alt="Notifications"
              className="navbar-icon-img"
            />
          </div>

          {/* User Profile - Mask Group positioned at x: 1340, y: 20, width: 60, height: 60 */}
          {isAuthenticated ? (
            <div className="navbar-user-profile">
              <div className="navbar-avatar" onClick={toggleUserDropdown}>
                <img
                  src={
                    // user?.picture ||
                    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcToOoJnrndFqTIcvygz9DmXfGbhxfTCxss17g&s"
                  }
                  alt="User"
                />
              </div>

              {showUserDropdown && (
                <div className="navbar-user-dropdown">
                  <div className="dropdown-item">
                    <span>Welcome, {user?.name || user?.email}</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button
                    className="dropdown-item logout-button"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleLogin} className="navbar-login-button">
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
