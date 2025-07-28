import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { deleteUser, getUser } from "../../api/user";
import "./DeleteUser.css";

const DeleteUser: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [confirmationText, setConfirmationText] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getUser(id!);
        setUser(userData);
      } catch (err) {
        setError("Failed to fetch user details");
      } finally {
        setFetching(false);
      }
    };
    fetchUser();
  }, [id]);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deleteUser(id!);
      // Invalidate and refetch the users query to update the table
      queryClient.invalidateQueries({ queryKey: ["users"] });
      navigate("/users");
    } catch (err: any) {
      setError("Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/users");
  };

  // Check if the confirmation text matches the user's name exactly
  const isConfirmationValid = confirmationText === user?.name;

  if (fetching) return <div className="delete-user-loading">Loading...</div>;

  if (!user) {
    return <div className="delete-user-error">User not found</div>;
  }

  return (
    <div className="delete-user-container">
      <div className="delete-user-tab">Delete User</div>
      <div className="delete-user-content">
        <p>Are you sure you want to delete the user:</p>
        <div className="delete-user-details">
          <p>
            <strong>Name:</strong> {user.name}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
        </div>
        <p>This action cannot be undone.</p>

        <div className="delete-user-confirmation">
          <p>
            To confirm deletion, please type <strong>"{user.name}"</strong> in
            the field below:
          </p>
          <input
            type="text"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder={`Type "${user.name}" to confirm`}
            className="delete-user-confirmation-input"
            disabled={loading}
          />
          {confirmationText && !isConfirmationValid && (
            <div className="delete-user-confirmation-error">
              The name doesn't match. Please type the exact name to confirm
              deletion.
            </div>
          )}
        </div>

        {error && <div className="delete-user-error">{error}</div>}

        <div className="delete-user-actions">
          <button
            className="delete-user-cancel-btn"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="delete-user-confirm-btn"
            onClick={handleDelete}
            disabled={loading || !isConfirmationValid}
          >
            {loading ? "Deleting..." : "Delete User"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteUser;
