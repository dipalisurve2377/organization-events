import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { updateUser, getUser } from "../../api/user";
import "./EditUser.css";

const EditUser: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

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
    try {
      await updateUser(id!, { name });
      navigate("/users");
    } catch (err: any) {
      setError("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="edit-user-loading">Loading...</div>;

  return (
    <div className="edit-user-container">
      <div className="edit-user-tab">Edit Profile</div>
      <form
        className="edit-user-form edit-user-form-single"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="edit-user-label">Name</label>
          <input
            className="edit-user-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter name"
            required
          />
        </div>
        {error && <div className="edit-user-error">{error}</div>}
        <button className="edit-user-save-btn" type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
};

export default EditUser;
