import React from "react";
import "../../styles/Sidebar.css";

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}

const sidebarItems: SidebarItem[] = [
  {
    label: "Users",
    icon: (
      <svg
        width="25"
        height="25"
        viewBox="0 0 25 25"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.5 12.5C14.9853 12.5 17 10.4853 17 8C17 5.51472 14.9853 3.5 12.5 3.5C10.0147 3.5 8 5.51472 8 8C8 10.4853 10.0147 12.5 12.5 12.5Z"
          fill="#3960FF"
        />
        <path
          d="M3 21C3 17.6863 6.13401 15 10 15H15C18.866 15 22 17.6863 22 21V21.5H3V21Z"
          fill="#3960FF"
        />
      </svg>
    ),
    active: true,
  },
  {
    label: "Organizations",
    icon: (
      <div
        style={{
          width: "25px",
          height: "25px",
          backgroundColor: "#C5C5CF",
          borderRadius: "4px",
        }}
      />
    ),
  },
];

const SidebarMenu: React.FC = () => {
  return (
    <aside className="sidebar">
      platformatroy
      <div className="sidebar-items">
        {sidebarItems.map((item, index) => (
          <div
            key={index}
            className={`sidebar-item ${item.active ? "active" : ""}`}
          >
            <div className="sidebar-icon">{item.icon}</div>
            <span className="sidebar-label">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="sidebar-divider" />
    </aside>
  );
};

export default SidebarMenu;
