import React, { useState } from "react";
import { createUser } from "../../api/user";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Form, FormColumn, Input } from "../../components";

const CreateUser: React.FC = () => {
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
      toast.success("User created successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      // Redirect to user table after successful signup
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Failed to create user";
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
    <Form
      onSubmit={handleSubmit}
      title="Create User"
      loading={loading}
      error={error}
      success={
        success
          ? "User created successfully! Redirecting to user list..."
          : null
      }
      submitButtonText="Submit"
      submitButtonDisabled={loading}
    >
      <FormColumn>
        <Input
          type="text"
          name="name"
          value={form.name}
          onChange={handleChange}
          label="Name"
          placeholder="Enter name"
          required
        />
        <Input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          label="Email"
          placeholder="Enter email"
          required
        />
      </FormColumn>
      <FormColumn>
        <Input
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          label="Password"
          placeholder="Enter password"
          required
        />
      </FormColumn>
    </Form>
  );
};

export default CreateUser;
