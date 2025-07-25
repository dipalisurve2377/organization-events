import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "./EditUser.css";

const EditUser: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await axios.put(`http://localhost:7001/api/users/${id}`, {
        updates: { name },
      });
      navigate("/users");
    } catch (err: any) {
      setError("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

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
