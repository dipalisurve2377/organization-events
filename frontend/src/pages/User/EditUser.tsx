import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getUser, updateUser } from "../../api/user";
import { toast } from "react-toastify";
import { Form, FormColumn, Input } from "../../components";

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

  if (fetching)
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "#718dc0" }}>
        Loading...
      </div>
    );

  return (
    <Form
      onSubmit={handleSubmit}
      title="Edit Profile"
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
          label="Your Name"
          placeholder="Enter name"
          required
        />
      </FormColumn>
      <FormColumn>
        <div></div>
      </FormColumn>
    </Form>
  );
};

export default EditUser;
