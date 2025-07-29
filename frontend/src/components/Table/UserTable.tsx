import React, { useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./UserTable.css";
import { deleteUser } from "../../api/user";
import DeleteModal from "../Modal/DeleteModal";
import Pagination from "../Pagination/Pagination";

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
  const queryClient = useQueryClient();
  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const navigate = useNavigate();
  const { searchTerm } = useSearchContext();

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
    setOpenMenuId(null);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    try {
      // Call the delete API
      await deleteUser(userToDelete.id.replace(/^auth0\|/, ""));

      // Show success toast
      toast.success("User deleted successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      // Poll for deletion status
      const pollForDeletion = async () => {
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds
        const pollInterval = 1000; // 1 second

        const checkStatus = async () => {
          try {
            const response = await axios.get(
              `http://localhost:7001/api/users/${userToDelete.id.replace(
                /^auth0\|/,
                ""
              )}`
            );
            const userStatus = (response.data as any).status;

            if (userStatus === "deleted" || userStatus === "failed") {
              // Stop polling and refresh the list
              await queryClient.invalidateQueries({ queryKey: ["users"] });
              return;
            }
          } catch (error) {
            // User might be deleted, refresh the list
            await queryClient.invalidateQueries({ queryKey: ["users"] });
            return;
          }

          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, pollInterval);
          } else {
            // Timeout, refresh anyway
            await queryClient.invalidateQueries({ queryKey: ["users"] });
          }
        };

        setTimeout(checkStatus, pollInterval);
      };

      pollForDeletion();
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "Failed to delete user";
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      throw error; // Re-throw to be handled by the modal
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  if (isLoading) return <div className="user-table-loading">Loading...</div>;
  if (isError)
    return <div className="user-table-error">Failed to fetch users</div>;

  return (
    <>
      <div className="user-table-container">
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
                    ? format(new Date(user.createdAt), "dd MMM, hh.mm a")
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
                      <button onClick={() => handleDeleteClick(user)}>
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
      </div>

      {/* Reusable Pagination Component */}
      <Pagination
        currentPage={currentPage}
        totalItems={filteredUsers.length}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
      />

      {/* Reusable Delete Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        itemName={userToDelete?.name || ""}
        itemDetails={[
          { label: "Name", value: userToDelete?.name || "" },
          { label: "Email", value: userToDelete?.email || "" },
        ]}
        confirmText="Delete User"
        cancelText="Cancel"
        loadingText="Deleting User..."
      />
    </>
  );
};

export default UserTable;
