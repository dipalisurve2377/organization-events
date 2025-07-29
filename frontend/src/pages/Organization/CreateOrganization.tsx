import React, { useState } from "react";
import { createOrganization } from "../../api/organization";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Form, FormColumn, Input } from "../../components";

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
    <Form
      onSubmit={handleSubmit}
      title="Create Organization"
      loading={loading}
      error={error}
      success={
        success
          ? "Organization created successfully! Redirecting to organization list..."
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
          label="Organization Name"
          placeholder="Enter organization name"
          required
        />
        <Input
          type="text"
          name="identifier"
          value={form.identifier}
          onChange={handleChange}
          label="Identifier"
          placeholder="Enter organization identifier"
          required
        />
      </FormColumn>
      <FormColumn>
        <Input
          type="email"
          name="createdByEmail"
          value={form.createdByEmail}
          onChange={handleChange}
          label="Created By Email"
          placeholder="Enter creator email"
          required
        />
      </FormColumn>
    </Form>
  );
};

export default CreateOrganization;
