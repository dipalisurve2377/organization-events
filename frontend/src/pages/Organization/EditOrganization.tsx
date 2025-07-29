import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getOrganization, updateOrganization } from "../../api/organization";
import { toast } from "react-toastify";
import { Form, FormColumn, Input } from "../../components";

const EditOrganization: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const organization = await getOrganization(id!);
        setName(organization.name || "");
        setIdentifier(organization.identifier || "");
      } catch (err) {
        setError("Failed to fetch organization details");
      } finally {
        setFetching(false);
      }
    };
    fetchOrganization();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await updateOrganization(id!, { name, identifier });

      // Show success message
      setSuccess(
        "Organization updated successfully! Please wait while we redirect you..."
      );

      // Show toast notification
      toast.success("Organization updated successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      // Invalidate the organizations cache to force a fresh fetch
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });

      // Add a delay to allow the workflow to complete and show success message
      setRedirecting(true);
      setTimeout(() => {
        navigate("/organizations");
      }, 2000);
    } catch (err: any) {
      const errorMessage = "Failed to update organization";
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

  if (fetching)
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "#718dc0" }}>
        Loading...
      </div>
    );

  return (
    <Form
      onSubmit={handleSubmit}
      title="Edit Organization"
      loading={loading}
      error={error}
      success={success}
      submitButtonText={redirecting ? "Redirecting..." : "Save"}
      submitButtonDisabled={loading || !!success}
    >
      <FormColumn>
        <Input
          type="text"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          label="Organization Name"
          placeholder="Enter organization name"
          required
        />
      </FormColumn>
      <FormColumn>
        <Input
          type="text"
          name="identifier"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          label="Identifier"
          placeholder="Enter organization identifier"
          required
        />
      </FormColumn>
    </Form>
  );
};

export default EditOrganization;
