import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./UserTable.css";
import { getOrganizations, deleteOrganization } from "../../api/organization";
import Button from "../Button/Button";
import { useSearchContext } from "../SearchBar/SearchContext";

interface Organization {
  id: string;
  name: string;
  identifier: string;
  createdByEmail?: string;
  createdAt?: string;
  status?: string;
}

const fetchOrganizations = async (): Promise<Organization[]> => {
  const organizations = await getOrganizations();
  return organizations.map((org: any) => ({
    id: org.id || org._id || "-",
    name: org.name || "-",
    identifier: org.identifier || "-",
    createdByEmail: org.createdByEmail || "-",
    createdAt: org.createdAt || org.created_at || "-",
    status: org.status || "-",
  }));
};

const statusClassMap: Record<string, string> = {
  failed: "failed",
  success: "success",
  updated: "updated",
  provisioning: "provisioning",
  deleting: "deleting",
};

const OrganizationTable: React.FC = () => {
  const queryClient = useQueryClient();
  const {
    data: organizations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Organization[]>({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const navigate = useNavigate();
  const { searchTerm } = useSearchContext();

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [organizationToDelete, setOrganizationToDelete] =
    useState<Organization | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Filter organizations based on search term
  const filteredOrganizations = organizations.filter((org) => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      org.name.toLowerCase().includes(searchLower) ||
      org.identifier.toLowerCase().includes(searchLower) ||
      (org.createdByEmail &&
        org.createdByEmail.toLowerCase().includes(searchLower)) ||
      org.id.toLowerCase().includes(searchLower) ||
      (org.status && org.status.toLowerCase().includes(searchLower))
    );
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredOrganizations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrganizations = filteredOrganizations.slice(
    startIndex,
    endIndex
  );

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

  // Handle delete button click
  const handleDeleteClick = (organization: Organization) => {
    setOrganizationToDelete(organization);
    setShowDeleteModal(true);
    setDeleteConfirmation("");
    setDeleteError(null);
    setOpenMenuId(null); // Close the action menu
  };

  // Handle actual delete
  const handleConfirmDelete = async () => {
    if (!organizationToDelete) return;

    if (deleteConfirmation !== organizationToDelete.name) {
      setDeleteError(
        "Name does not match. Please type the exact name to confirm deletion."
      );
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      // Start the delete workflow
      await deleteOrganization(organizationToDelete.id);

      // Poll for deletion status
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds
      const pollInterval = 1000; // 1 second

      const pollForDeletion = async () => {
        try {
          const updatedOrganizations = await refetch();
          const organization = updatedOrganizations.data?.find(
            (org) => org.id === organizationToDelete.id
          );

          // If organization is not found, it's been deleted
          if (!organization) {
            return true;
          }

          // If status is failed, throw error
          if (organization.status === "failed") {
            throw new Error("Delete operation failed");
          }

          // If status is deleting, continue polling
          if (organization.status === "deleting") {
            return false;
          }

          // If status is deleted, we're done
          if (organization.status === "deleted") {
            return true;
          }

          return false;
        } catch (error) {
          console.error("Error polling for deletion status:", error);
          return false;
        }
      };

      // Poll until deletion is complete or max attempts reached
      while (attempts < maxAttempts) {
        const isComplete = await pollForDeletion();
        if (isComplete) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error(
          "Delete operation timed out. Please refresh the page to see the current status."
        );
      }

      // Invalidate the cache and refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      await refetch();

      // Close modal and reset state
      setShowDeleteModal(false);
      setOrganizationToDelete(null);
      setDeleteConfirmation("");

      // Show success toast
      toast.success("Organization deleted successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (err: any) {
      const errorMessage =
        err.message || "Failed to delete organization. Please try again.";
      setDeleteError(errorMessage);
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle cancel delete
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setOrganizationToDelete(null);
    setDeleteConfirmation("");
    setDeleteError(null);
  };

  if (isLoading) return <div className="user-table-loading">Loading...</div>;
  if (isError)
    return (
      <div className="user-table-error">Failed to fetch organizations</div>
    );

  return (
    <>
      <div className="user-table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Created at</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentOrganizations.map((org: Organization) => (
              <tr key={org.id}>
                <td>{org.id ? org.id.replace(/^auth0\|/, "") : "-"}</td>
                <td>{org.name || "-"}</td>

                <td>
                  {org.createdAt && org.createdAt !== "-"
                    ? format(new Date(org.createdAt), "dd MMM, hh.mm a")
                    : "-"}
                </td>
                <td
                  className={`user-status user-status-${
                    statusClassMap[org.status?.toLowerCase() || ""]
                  }`}
                >
                  {org.status || "-"}
                </td>
                <td
                  className="user-table-action-cell"
                  style={{ position: "relative" }}
                >
                  <button
                    className="user-table-action"
                    onClick={() =>
                      setOpenMenuId(openMenuId === org.id ? null : org.id)
                    }
                  >
                    ...
                  </button>
                  {openMenuId === org.id && (
                    <div className="user-table-action-menu">
                      <button
                        onClick={() =>
                          navigate(
                            `/organizations/edit/${org.id.replace(
                              /^auth0\|/,
                              ""
                            )}`
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
                      <button onClick={() => handleDeleteClick(org)}>
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
      {/* Pagination should be outside the card */}
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && organizationToDelete && (
        <div className="delete-modal-overlay">
          <div className="delete-modal">
            <div className="delete-modal-header">
              <h3>Delete Organization</h3>
            </div>
            <div className="delete-modal-content">
              <p>Are you sure you want to delete this organization?</p>
              <div className="delete-modal-user-details">
                <p>
                  <strong>Name:</strong> {organizationToDelete.name}
                </p>
                <p>
                  <strong>Identifier:</strong> {organizationToDelete.identifier}
                </p>
              </div>
              <p>This action cannot be undone.</p>

              <div className="delete-modal-confirmation">
                <label htmlFor="delete-confirmation">
                  Type <strong>"{organizationToDelete.name}"</strong> to confirm
                  deletion:
                </label>
                <input
                  id="delete-confirmation"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder={`Type "${organizationToDelete.name}" to confirm`}
                  className="delete-modal-input"
                />
              </div>

              {deleteError && (
                <div className="delete-modal-error">{deleteError}</div>
              )}
            </div>
            <div className="delete-modal-actions">
              <button
                className="delete-modal-cancel-btn"
                onClick={handleCancelDelete}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="delete-modal-confirm-btn"
                onClick={handleConfirmDelete}
                disabled={
                  deleteLoading ||
                  deleteConfirmation !== organizationToDelete.name
                }
              >
                {deleteLoading ? (
                  <>
                    <span
                      className="loading-spinner"
                      style={{ marginRight: 8 }}
                    ></span>
                    Deleting Organization...
                  </>
                ) : (
                  "Delete Organization"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrganizationTable;
