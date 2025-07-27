import React, { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import "./UserTable.css";
import { deleteUser } from "../../api/user";
import Button from "../Button/Button";
import { useSearchContext } from "../SearchBar/SearchContext";

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  status?: string | null;
}

const fetchUsers = async (): Promise<User[]> => {
  const res = await axios.get<{ users: any[] }>(
    "http://localhost:7001/api/users"
  );
  return (res.data.users || []).map((user) => {
    return {
      id: user.user_id || user._id || (user.auth0 && user.auth0.user_id) || "-",
      email: user.email || (user.auth0 && user.auth0.email) || "-",
      name: user.name || (user.auth0 && user.auth0.name) || "-",
      createdAt:
        user.created_at ||
        user.createdAt ||
        (user.auth0 && (user.auth0.created_at || user.auth0.createdAt)) ||
        "-",
      status: user.status || "-",
    };
  });
};

const statusClassMap: Record<string, string> = {
  failed: "failed",
  success: "success",
  updated: "updated",
  provisioning: "provisioning",
  deleting: "deleting",
};

const UserTable: React.FC = () => {
  const {
    data: users = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(3);
  const navigate = useNavigate();
  const { searchTerm } = useSearchContext();

  // Filter users based on search term
  const filteredUsers = users.filter((user) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.id.toLowerCase().includes(searchLower) ||
      (user.status && user.status.toLowerCase().includes(searchLower))
    );
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (isLoading) return <div className="user-table-loading">Loading...</div>;
  if (isError)
    return <div className="user-table-error">Failed to fetch users</div>;

  return (
    <div className="user-table-container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          padding: "0 1rem",
        }}
      >
        {/* <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "600" }}>
          Users
        </h2> */}
        <Button
          variant="primary"
          size="medium"
          onClick={() => navigate("/signup")}
          className="create-user-button"
        >
          Create User
        </Button>
      </div>
      <table className="user-table">
        <thead>
          <tr>
            <th>Id</th>
            <th>Email</th>
            <th>Name</th>
            <th>Created at</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {currentUsers.map((user: User) => (
            <tr key={user.id}>
              <td>{user.id ? user.id.replace(/^auth0\|/, "") : "-"}</td>
              <td>{user.email || "-"}</td>
              <td>{user.name || "-"}</td>
              <td>
                {user.createdAt && user.createdAt !== "-"
                  ? format(new Date(user.createdAt), "dd MMM, yyyy, HH:mm:ss")
                  : "-"}
              </td>
              <td
                className={`user-status user-status-${
                  statusClassMap[user.status?.toLowerCase() || ""]
                }`}
              >
                {user.status || "-"}
              </td>
              <td
                className="user-table-action-cell"
                style={{ position: "relative" }}
              >
                <button
                  className="user-table-action"
                  onClick={() =>
                    setOpenMenuId(openMenuId === user.id ? null : user.id)
                  }
                >
                  ...
                </button>
                {openMenuId === user.id && (
                  <div className="user-table-action-menu">
                    <button
                      onClick={() =>
                        navigate(
                          `/users/edit/${user.id.replace(/^auth0\|/, "")}`
                        )
                      }
                    >
                      <span className="edit-icon">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 20 20"
                          fill="none"
                        >
                          <path
                            d="M4 13.5V16h2.5l7.06-7.06-2.5-2.5L4 13.5z"
                            stroke="#2d60ff"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M13.06 6.44l1.5-1.5a1 1 0 0 1 1.41 0l.59.59a1 1 0 0 1 0 1.41l-1.5 1.5-2.5-2.5z"
                            stroke="#2d60ff"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </span>
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        await deleteUser(user.id);
                        refetch();
                      }}
                    >
                      <span className="delete-icon">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 20 20"
                          fill="none"
                        >
                          <path
                            d="M6 7v7a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7"
                            stroke="#fe5c73"
                            strokeWidth="1.5"
                          />
                          <path
                            d="M9 10v4M11 10v4M4 7h12M8 7V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"
                            stroke="#fe5c73"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </span>
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <div className="pagination">
            {/* Previous Button */}
            <button
              className={`pagination-button ${
                currentPage === 1 ? "disabled" : ""
              }`}
              onClick={handlePrevious}
              disabled={currentPage === 1}
            >
              <svg width="12" height="6" viewBox="0 0 12 6" fill="none">
                <path
                  d="M11 1L6 5L1 1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(90 6 3)"
                />
              </svg>
              <span>Previous</span>
            </button>

            {/* Page Numbers */}
            <div className="page-numbers">
              {getPageNumbers().map((page, index) => (
                <React.Fragment key={index}>
                  {page === "..." ? (
                    <span className="page-ellipsis">...</span>
                  ) : (
                    <button
                      className={`page-number ${
                        currentPage === page ? "active" : ""
                      }`}
                      onClick={() => handlePageChange(page as number)}
                    >
                      {page}
                    </button>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Next Button */}
            <button
              className={`pagination-button ${
                currentPage === totalPages ? "disabled" : ""
              }`}
              onClick={handleNext}
              disabled={currentPage === totalPages}
            >
              <span>Next</span>
              <svg width="12" height="6" viewBox="0 0 12 6" fill="none">
                <path
                  d="M1 1L6 5L11 1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform="rotate(-90 6 3)"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserTable;
