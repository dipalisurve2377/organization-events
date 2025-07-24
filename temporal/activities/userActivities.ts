import axios from "axios";
import mongoose, { connection } from "mongoose";
import dotenv from "dotenv";
import { getAuth0Token } from "../services/user_auth0Service.js";
import { ApplicationFailure } from "@temporalio/client";

dotenv.config();

let connected = false;

export const connectDB = async (): Promise<void> => {
  if (connected) return;

  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    connected = true;
    console.log("MongoDB connected.");
  } catch (err: any) {
    console.error("MongoDB connection failed:", err.message);
    throw ApplicationFailure.create({
      message: `MongoDB connection failed: ${err.message}`,
      type: "MongoConnectionError",
      nonRetryable: false,
    });
  }
};

// User Schema (duplicate of backend's User model)

const userSchema = new mongoose.Schema(
  {
    email: String,
    auth0Id: String,
    status: String,
    name: String,
  },
  { timestamps: true }
);
const User = mongoose.models.User || mongoose.model("User", userSchema);

// Auth0 activity

export const createUserInAuth0 = async (
  email: string,
  password: string,
  name: string
): Promise<string> => {
  try {
    const token = await getAuth0Token();

    console.log("Sending user to Auth0:", {
      email,
      password,
      name,
      connection: "Username-Password-Authentication",
      token,
    });

    const userRes = await axios.post(
      `https://${process.env.AUTH0_USER_DOMAIN}/api/v2/users`,
      {
        email,
        password,
        name,
        connection: `Username-Password-Authentication`,
        email_verified: false,
        verify_email: false,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return userRes.data.user_id;
  } catch (error: any) {
    let errorMessage = `Failed to create user in Auth0 (email: ${email})`;

    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = JSON.stringify(error.response.data);
      errorMessage += ` — Auth0 responded with status ${status}: ${data}`;

      if (status >= 400 && status < 500) {
        throw ApplicationFailure.create({
          message: errorMessage,
          type: "Auth0ClientError",
          nonRetryable: true,
        });
      }

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "Auth0ServerError",
        nonRetryable: false,
      });
    } else if (axios.isAxiosError(error) && error.request) {
      errorMessage +=
        " — No response received from Auth0. Possible network or DNS issue.";
      throw ApplicationFailure.create({
        message: errorMessage,
        type: "NetworkError",
        nonRetryable: false,
      });
    } else {
      errorMessage += ` — Unexpected setup error: ${
        error.message || "Unknown"
      }`;
      throw ApplicationFailure.create({
        message: errorMessage,
        type: "GenericCreateFailure",
        nonRetryable: true,
      });
    }
  }
};

export const saveAuth0IdToMongoDB = async (
  email: string,
  auth0Id: string
): Promise<void> => {
  await connectDB();

  try {
    const result = await User.findOneAndUpdate(
      { email },
      { auth0Id },
      { new: true }
    );

    if (!result) {
      throw ApplicationFailure.create({
        message: `User not found with the email: ${email}`,
        type: "MongoUserUpdateError",
        nonRetryable: true,
      });
    }

    console.log(`Saved Auth0 ID to MongoDB: ${auth0Id} for ${email}`);
  } catch (error: any) {
    console.log("MongoDB update failed");

    throw ApplicationFailure.create({
      message: `Failed to update Auth0 ID in MongoDB for email ${email}. ${error.message}`,
      type: "MongoUserUpdateFailure",
      nonRetryable: false,
    });
  }
};

// mongoDB activity

export const updateUserStatus = async (
  email: string,
  status:
    | "provisioning"
    | "success"
    | "failed"
    | "updating"
    | "deleting"
    | "updated"
    | "deleted",
  auth0Id?: string,
  name?: string
) => {
  await connectDB();

  try {
    const update: any = { status };

    if (auth0Id) update.auth0Id = auth0Id;
    if (name) update.name = name;

    await User.findOneAndUpdate({ email }, update, { upsert: true, new: true });
  } catch (error: any) {
    console.error(`Failed to update status for ${email}:`, error.message);
    throw ApplicationFailure.create({
      message: `MongoDB update failed for user: ${email}. Reason: ${error.message}`,
      type: "MongoUserStatusUpdateFailure",
      nonRetryable: false,
    });
  }
};

// update in auth0 activity

export const updateUserInAuth0 = async (
  email: string,
  updates: { email?: string; password?: string; name?: string }
): Promise<void> => {
  try {
    await connectDB();

    const user = await User.findOne({ email });

    if (!user || !user.auth0Id) {
      throw ApplicationFailure.create({
        message: `User or Auth0 ID not found for email: ${email}`,
        type: "MissingAuth0ID",
        nonRetryable: true,
      });
    }

    const token = await getAuth0Token();

    const payload: any = { ...updates };
    if (updates.password) {
      payload.connection = "Username-Password-Authentication";
    }

    await axios.patch(
      `https://${process.env.AUTH0_USER_DOMAIN}/api/v2/users/${user.auth0Id}`,
      updates,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    await updateUserStatus(email, "updated", undefined, updates.name);
  } catch (error: any) {
    let errorMessage = `Failed to update user (email: ${email})`;

    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = JSON.stringify(error.response.data);
      errorMessage += ` — Auth0 responded with status ${status}: ${data}`;

      if (status >= 400 && status < 500) {
        throw ApplicationFailure.create({
          message: errorMessage,
          type: "Auth0ClientError",
          nonRetryable: true,
        });
      }

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "Auth0ServerError",
        nonRetryable: false,
      });
    } else if (axios.isAxiosError(error) && error.request) {
      errorMessage += " — No response from Auth0 (network issue).";

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "NetworkError",
        nonRetryable: false,
      });
    } else {
      errorMessage += ` — Unexpected error: ${error?.message || "Unknown"}`;

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "GenericUpdateFailure",
        nonRetryable: true,
      });
    }
  }
};

export const deleteUserFromAuth0 = async (email: string): Promise<void> => {
  try {
    await connectDB();

    const user = await User.findOne({ email });

    if (!user || !user.auth0Id) {
      throw ApplicationFailure.create({
        message: `User not found or missing Auth0 ID for email: ${email}`,
        type: "MissingAuth0ID",
        nonRetryable: true,
      });
    }

    const token = await getAuth0Token();

    await axios.delete(
      `https://${process.env.AUTH0_USER_DOMAIN}/api/v2/users/${user.auth0Id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error: any) {
    let errorMessage = `Failed to delete user (email: ${email})`;

    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = JSON.stringify(error.response.data);
      errorMessage += ` — Auth0 responded with ${status}: ${data}`;

      if (status >= 400 && status < 500) {
        throw ApplicationFailure.create({
          message: errorMessage,
          type: "Auth0ClientError",
          nonRetryable: true,
        });
      }

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "Auth0ServerError",
        nonRetryable: false,
      });
    } else if (axios.isAxiosError(error) && error.request) {
      errorMessage += " — No response from Auth0. Network issue?";
      throw ApplicationFailure.create({
        message: errorMessage,
        type: "NetworkError",
        nonRetryable: false,
      });
    } else {
      errorMessage += ` — Unexpected error: ${error?.message || "Unknown"}`;
      throw ApplicationFailure.create({
        message: errorMessage,
        type: "GenericDeleteFailure",
        nonRetryable: true,
      });
    }
  }
};

export const deleteUserFromDB = async (userId: string): Promise<void> => {
  try {
    await connectDB();

    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      throw ApplicationFailure.create({
        message: `User not found with userId: ${userId}`,
        type: "MongoDeleteError",
        nonRetryable: true,
      });
    }

    console.log(`Deleted user from MongoDB: ${userId}`);
  } catch (error: any) {
    console.error("Error deleting user from MongoDB:", error);

    throw ApplicationFailure.create({
      message: `Failed to hard delete user from MongoDB. ${error.message}`,
      type: "MongoDeleteFailure",
      nonRetryable: false,
    });
  }
};

export const listUsersFromAuth0 = async (): Promise<any[]> => {
  try {
    const token = await getAuth0Token();

    const usersRes = await axios.get(
      `https://${process.env.AUTH0_USER_DOMAIN}/api/v2/users`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return usersRes.data;
  } catch (error: any) {
    let errorMessage = `Failed to list users from Auth0`;

    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const data = JSON.stringify(error.response.data);
      errorMessage += ` — Auth0 responded with status ${status}: ${data}`;

      if (status >= 400 && status < 500) {
        throw ApplicationFailure.create({
          message: errorMessage,
          type: "Auth0ClientError",
          nonRetryable: true,
        });
      }

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "Auth0ServerError",
        nonRetryable: false,
      });
    } else if (axios.isAxiosError(error) && error.request) {
      errorMessage += " — No response received from Auth0 (network issue).";
      throw ApplicationFailure.create({
        message: errorMessage,
        type: "NetworkError",
        nonRetryable: false,
      });
    } else {
      errorMessage += ` — Unexpected error: ${
        error?.message || "Unknown error"
      }`;
      throw ApplicationFailure.create({
        message: errorMessage,
        type: "GenericListFailure",
        nonRetryable: true,
      });
    }
  }
};
