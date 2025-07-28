import React, { useState } from "react";
import { createUser } from "../../api/user";
import Button from "../../components/Button/Button";
import { useNavigate } from "react-router-dom";
import "./Signup.css";

const Signup: React.FC = () => {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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
      await createUser(form);
      setSuccess(true);
      setForm({ name: "", email: "", password: "" });
      // Redirect to user table after successful signup
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-tab">Create User</div>
      <form onSubmit={handleSubmit} className="signup-form">
        <div className="signup-form-content">
          <div className="signup-column">
            <div className="signup-field">
              <label className="signup-label">Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="signup-input"
                placeholder="Enter name"
              />
            </div>
            <div className="signup-field">
              <label className="signup-label">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="signup-input"
                placeholder="Enter email"
              />
            </div>
          </div>
          <div className="signup-column">
            <div className="signup-field">
              <label className="signup-label">Password</label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                className="signup-input"
                placeholder="Enter password"
              />
            </div>
          </div>
        </div>
        {error && <div className="signup-error">{error}</div>}
        {success && (
          <div className="signup-success">
            User created successfully! Redirecting to user list...
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

export default Signup;
