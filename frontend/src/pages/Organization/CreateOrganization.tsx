import React, { useState } from "react";
import { createOrganization } from "../../api/organization";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "../User/CreateUser.css";

const CreateOrganization: React.FC = () => {
  const [form, setForm] = useState({
    name: "",
    identifier: "",
    createdByEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await createOrganization(form);
      setSuccess(true);
      setForm({ name: "", identifier: "", createdByEmail: "" });
      toast.success("Organization created successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      // Redirect to organization table after successful creation
      setTimeout(() => {
        navigate("/organizations");
      }, 1500);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to create organization";
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

  return (
    <div className="signup-container">
      <div className="signup-tab">Create Organization</div>
      <form onSubmit={handleSubmit} className="signup-form">
        <div className="signup-form-content">
          <div className="signup-column">
            <div className="signup-field">
              <label className="signup-label">Organization Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="signup-input"
                placeholder="Enter organization name"
              />
            </div>
            <div className="signup-field">
              <label className="signup-label">Identifier</label>
              <input
                type="text"
                name="identifier"
                value={form.identifier}
                onChange={handleChange}
                required
                className="signup-input"
                placeholder="Enter organization identifier"
              />
            </div>
          </div>
          <div className="signup-column">
            <div className="signup-field">
              <label className="signup-label">Created By Email</label>
              <input
                type="email"
                name="createdByEmail"
                value={form.createdByEmail}
                onChange={handleChange}
                required
                className="signup-input"
                placeholder="Enter creator email"
              />
            </div>
          </div>
        </div>
        {error && <div className="signup-error">{error}</div>}
        {success && (
          <div className="signup-success">
            Organization created successfully! Redirecting to organization
            list...
          </div>
        )}
        <div className="signup-button-container">
          <button
            type="submit"
            disabled={loading}
            className="signup-submit-btn"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateOrganization;
