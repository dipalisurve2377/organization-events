import React, { useState } from "react";
import "./DeleteModal.css";

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  itemName: string;
  itemDetails: Array<{ label: string; value: string }>;
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  className?: string;
  style?: React.CSSProperties;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemDetails,
  confirmText = "Delete",
  cancelText = "Cancel",
  loadingText = "Deleting...",
  className = "",
  style,
}) => {
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (deleteConfirmation !== itemName) return;

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await onConfirm();
      handleClose();
    } catch (error: any) {
      setDeleteError(error.message || "Failed to delete item");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClose = () => {
    setDeleteConfirmation("");
    setDeleteError(null);
    setDeleteLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="delete-modal-overlay">
      <div className={`delete-modal ${className}`} style={style}>
        <div className="delete-modal-header">
          <h3>{title}</h3>
        </div>
        <div className="delete-modal-content">
          <p>Are you sure you want to delete this item?</p>
          <div className="delete-modal-item-details">
            {itemDetails.map((detail, index) => (
              <p key={index}>
                <strong>{detail.label}:</strong> {detail.value}
              </p>
            ))}
          </div>
          <p>This action cannot be undone.</p>

          <div className="delete-modal-confirmation">
            <label htmlFor="delete-confirmation">
              Type <strong>"{itemName}"</strong> to confirm deletion:
            </label>
            <input
              id="delete-confirmation"
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={`Type "${itemName}" to confirm`}
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
            onClick={handleClose}
            disabled={deleteLoading}
          >
            {cancelText}
          </button>
          <button
            className="delete-modal-confirm-btn"
            onClick={handleConfirm}
            disabled={deleteLoading || deleteConfirmation !== itemName}
          >
            {deleteLoading ? (
              <>
                <span
                  className="loading-spinner"
                  style={{ marginRight: 8 }}
                ></span>
                {loadingText}
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
