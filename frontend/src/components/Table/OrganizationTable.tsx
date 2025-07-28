import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import "./OrganizationTable.css";
import { getOrganizations } from "../../api/organization";
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
  const [itemsPerPage] = useState(3);
  const navigate = useNavigate();
  const { searchTerm } = useSearchContext();

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

  if (isLoading)
    return <div className="organization-table-loading">Loading...</div>;
  if (isError)
    return (
      <div className="organization-table-error">
        Failed to fetch organizations
      </div>
    );

  return (
    <div className="organization-table-container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          padding: "0 1rem",
        }}
      >
        <Button
          variant="primary"
          size="medium"
          onClick={() => navigate("/organizations/create")}
          className="create-organization-button"
        >
          Create Organization
        </Button>
      </div>
      <table className="organization-table">
        <thead>
          <tr>
            <th>Id</th>
            <th>Name</th>
            <th>Identifier</th>
            <th>Created By</th>
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
              <td>{org.identifier || "-"}</td>
              <td>{org.createdByEmail || "-"}</td>
              <td>
                {org.createdAt && org.createdAt !== "-"
                  ? format(new Date(org.createdAt), "dd MMM, yyyy, HH:mm:ss")
                  : "-"}
              </td>
              <td
                className={`organization-status organization-status-${
                  statusClassMap[org.status?.toLowerCase() || ""]
                }`}
              >
                {org.status || "-"}
              </td>
              <td
                className="organization-table-action-cell"
                style={{ position: "relative" }}
              >
                <button
                  className="organization-table-action"
                  onClick={() =>
                    setOpenMenuId(openMenuId === org.id ? null : org.id)
                  }
                >
                  ...
                </button>
                {openMenuId === org.id && (
                  <div className="organization-table-action-menu">
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
                    <button
                      onClick={() => {
                        // TODO: Implement delete functionality
                        console.log("Delete organization:", org.id);
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

export default OrganizationTable;
