import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUser, updateUser } from "../../api/user";
import { toast } from "react-toastify";
import "./EditUser.css";

const EditUser: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getUser(id!);
        setName(user.name || "");
      } catch (err) {
        setError("Failed to fetch user details");
      } finally {
        setFetching(false);
      }
    };
    fetchUser();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateUser(id!, { name });

      // Show success message
      setSuccess(
        "User updated successfully! Please wait while we redirect you..."
      );

      // Show toast notification
      toast.success("User updated successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      // Invalidate the users cache to force a fresh fetch
      await queryClient.invalidateQueries({ queryKey: ["users"] });

      // Add a delay to allow the workflow to complete and show success message
      setRedirecting(true);
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err: any) {
      const errorMessage = "Failed to update user";
      setError(errorMessage);
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="edit-user-loading">Loading...</div>;

  return (
    <div className="edit-user-container">
      <div className="edit-user-tab">Edit Profile</div>
      <form className="edit-user-form" onSubmit={handleSubmit}>
        <div className="edit-user-form-content">
          <div className="edit-user-column">
            <div className="edit-user-field">
              <label className="edit-user-label">Your Name</label>
              <input
                className="edit-user-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name"
                required
              />
            </div>
          </div>
          <div className="edit-user-column">
            {/* Empty column for balance - can be used for additional fields later */}
          </div>
        </div>
        {error && <div className="edit-user-error">{error}</div>}
        {success && <div className="edit-user-success">{success}</div>}
        <div className="edit-user-button-container">
          <button
            className="edit-user-save-btn"
            type="submit"
            disabled={loading || !!success}
          >
            {loading ? "Saving..." : redirecting ? "Redirecting..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditUser;
