import React from "react";
import "./Pagination.css";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  className?: string;
  style?: React.CSSProperties;
  showPagination?: boolean;
  maxVisiblePages?: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = "",
  style,
  showPagination = true,
  maxVisiblePages = 5,
}) => {
  // Calculate pagination
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Don't render if no pagination needed
  if (!showPagination || totalPages <= 1) {
    return null;
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];

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

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageChange = (page: number) => {
    onPageChange(page);
  };

  return (
    <div className={`pagination-container ${className}`} style={style}>
      <div className="pagination">
        {/* Previous Button */}
        <button
          className={`pagination-button ${currentPage === 1 ? "disabled" : ""}`}
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
  );
};

export default Pagination;
