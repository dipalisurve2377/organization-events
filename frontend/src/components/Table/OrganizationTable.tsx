import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./UserTable.css";
import { getOrganizations, deleteOrganization } from "../../api/organization";
import Button from "../Button/Button";
import DeleteModal from "../Modal/DeleteModal";
import Pagination from "../Pagination/Pagination";
import { useSearchContext } from "../SearchBar/SearchContext";
import Loader from "../Loader/Loader";

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle delete button click
  const handleDeleteClick = (organization: Organization) => {
    setOrganizationToDelete(organization);
    setShowDeleteModal(true);
  };

  // Handle actual delete
  const handleConfirmDelete = async () => {
    if (!organizationToDelete) return;

    try {
      // Start the delete workflow
      await deleteOrganization(organizationToDelete.id);

      // Poll for status updates until the organization is deleted or status changes
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      const pollInterval = 1000; // 1 second

      const pollForDeletion = async () => {
        try {
          // Refetch organizations to get updated status
          await refetch();

          // Check if organization still exists and get their current status
          const updatedOrganizations = await fetchOrganizations();
          const updatedOrganization = updatedOrganizations.find(
            (o) => o.id === organizationToDelete.id
          );

          if (!updatedOrganization) {
            // Organization has been completely deleted
            return true;
          }

          if (updatedOrganization.status === "deleted") {
            // Organization has been marked as deleted
            return true;
          }

          if (updatedOrganization.status === "failed") {
            throw new Error("Organization deletion failed");
          }

          // Still processing, continue polling
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
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      throw err; // Re-throw to be handled by the modal
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setOrganizationToDelete(null);
  };

  if (isLoading) return <Loader />;
  if (isError)
    return (
      <div className="user-table-error">
        Failed to fetch organizations: {error?.message}
      </div>
    );

  return (
    <>
      <div className="user-table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Identifier</th>
              <th>Created By Email</th>
              <th>Created at</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentOrganizations.map((organization: Organization) => (
              <tr key={organization.id}>
                <td>{organization.id}</td>
                <td>{organization.name}</td>
                <td>{organization.identifier}</td>
                <td>{organization.createdByEmail}</td>
                <td>
                  {organization.createdAt && organization.createdAt !== "-"
                    ? format(
                        new Date(organization.createdAt),
                        "dd MMM, hh.mm a"
                      )
                    : "-"}
                </td>
                <td
                  className={`user-status user-status-${
                    statusClassMap[organization.status?.toLowerCase() || ""]
                  }`}
                >
                  {organization.status}
                </td>
                <td
                  className="user-table-action-cell"
                  style={{ position: "relative" }}
                >
                  <button
                    className="user-table-action"
                    onClick={() =>
                      setOpenMenuId(
                        openMenuId === organization.id ? null : organization.id
                      )
                    }
                  >
                    ...
                  </button>
                  {openMenuId === organization.id && (
                    <div className="user-table-action-menu">
                      <button
                        onClick={() =>
                          navigate(`/organizations/edit/${organization.id}`)
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
                      <button onClick={() => handleDeleteClick(organization)}>
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
        totalItems={filteredOrganizations.length}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
      />

      {/* Reusable Delete Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Organization"
        itemName={organizationToDelete?.name || ""}
        itemDetails={[
          { label: "Name", value: organizationToDelete?.name || "" },
          {
            label: "Identifier",
            value: organizationToDelete?.identifier || "",
          },
        ]}
        confirmText="Delete Organization"
        cancelText="Cancel"
        loadingText="Deleting Organization..."
      />
    </>
  );
};

export default OrganizationTable;
