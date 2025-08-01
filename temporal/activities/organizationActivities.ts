import mongoose, { Error } from "mongoose";
import nodemailer from "nodemailer";
import { getAuth0Token } from "../services/org_auth0Service.js";
import dotenv from "dotenv";
import axios, { AxiosError } from "axios";

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

const organizationSchema = new mongoose.Schema(
  {
    auth0Id: String,
    name: String,
    identifier: { type: String, unique: true },
    createdByEmail: String,
    status: {
      type: String,
      enum: [
        "provisioning",
        "updating",
        "deleting",
        "success",
        "failed",
        "updated",
        "deleted",
        "cancelled",
      ],
      default: "provisioning",
    },
  },
  {
    timestamps: true,
  }
);

const Organization =
  mongoose.models.Organization ||
  mongoose.model("Organization", organizationSchema);

// create organization in Auth0

//  This is the Activity Function Definition
export const createOrganizationInAuth0 = async (
  name: string,
  identifier: string,
  createdByEmail: string
): Promise<string> => {
  try {
    const token = await getAuth0Token();

    const url = `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations`;
    console.log("Calling URL:", url);

    const orgRes = await axios.post(
      `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations`,
      {
        display_name: name,
        name: identifier,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 5000,
      }
    );

    console.log("Organization created in Auth0", orgRes.data);

    const auth0Id = orgRes.data.id;

    console.log("Organization created in Auth0:", auth0Id);

    return auth0Id;
  } catch (error: any) {
    let errorMessage = "Failed to create organization in Auth0.";

    if (error.response) {
      const status = error.response.status;
      errorMessage += ` Auth0 responded with status ${status}: ${JSON.stringify(
        error.response.data
      )}`;

      // No retry on 4xx errors
      if (status >= 400 && status < 500) {
        // if request is bad or invalid
        throw ApplicationFailure.create({
          message: errorMessage,
          type: "Auth0ClientError",
          nonRetryable: true,
        });
      }

      // Retryable for 5xx
      // server issue timeout
      throw ApplicationFailure.create({
        message: errorMessage,
        type: "Auth0ServerError",
        nonRetryable: false,
      });
    }
    //The request was sent, but no response came back — maybe because of a network problem, or server timeout.
    else if (error.request) {
      // Network issue - retryable
      errorMessage += ` No response from Auth0. Possible network issue.`;

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "NetworkError",
        nonRetryable: false,
      });
    } else {
      // retryable
      errorMessage += ` Request setup failed: ${error.message}`;

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "RequestSetupError",
        nonRetryable: false,
      });
    }
  }
};

export const saveAuth0IdToMongoDB = async (
  identifier: string,
  auth0Id: string
): Promise<void> => {
  await connectDB();

  try {
    const result = await Organization.findOneAndUpdate(
      { identifier },
      { auth0Id },
      { new: true }
    );

    if (!result) {
      throw ApplicationFailure.create({
        message: `Organization not found with the identifier: ${identifier}`,
        type: "MongoUpdateError",
        nonRetryable: true,
      });
    }
    console.log(`Saved Auth0 ID to MongoDB: ${auth0Id} for ${identifier}`);
  } catch (error: any) {
    console.log("MongoDB update failed");

    throw ApplicationFailure.create({
      message: `Failed to update Auth0 ID in MongoDB for identifier ${identifier}. ${error.message}`,
      type: "MongoUpdateFailure",
      nonRetryable: false,
    });
  }
};

// sending email to the user

export const sendNotificationEmail = async (
  to: string,
  name: string,
  action: "created" | "updated" | "deleted" | "cancelled" | "failed" = "created"
): Promise<void> => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error(
        "EMAIL_USER or EMAIL_PASS environment variable is missing."
      );
    }
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 30000,
    });

    // creating dynamic body for mail
    let messageBody = "";
    if (action == "created") {
      messageBody = `<p>Hello,</p>
        <p>Your organization <strong>${name}</strong> has been <span style="color:green;"><strong>successfully created</strong></span>.</p>`;
    } else if (action == "updated") {
      messageBody = `<p>Hello,</p>
        <p>Your organization has been <span style="color:orange;"><strong>successfully updated to ${name}</strong></span>.</p>`;
    } else if (action == "deleted") {
      messageBody = `<p>Hello,</p>
        <p>Your organization <strong>${name}</strong> has been <span style="color:red;"><strong>successfully deleted</strong></span>.</p>`;
    }

    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        ${messageBody}
        <p style="margin-top: 20px;">Thank you,<br/>Organization Events Team</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `Organization ${action}`,
      html: htmlTemplate,
    });

    console.log(`Notification email sent to ${to} for action ${action}`);
  } catch (error: any) {
    const errorMsg = `Failed to send notification email to ${to} for action "${action}": ${error.message}`;
    console.error(errorMsg);

    throw new Error(errorMsg);
  }
};

// update the organization status in DB

export const updateOrganizationStatus = async (
  orgId: string,
  status:
    | "provisioning"
    | "success"
    | "failed"
    | "updating"
    | "deleting"
    | "updated"
    | "deleted"
    | "canceled",
  auth0Id?: string,
  name?: string
): Promise<void> => {
  try {
    await connectDB();

    const update: any = { status };

    if (auth0Id) update.auth0Id = auth0Id;
    if (name) update.name = name;

    const result = await Organization.findByIdAndUpdate(orgId, update, {
      new: true,
    });

    if (!result) {
      throw ApplicationFailure.create({
        message: `Organization not found for orgId ${orgId}`,
        type: "MongoUpdateError",
        nonRetryable: true,
      });
    }

    console.log(`Organization status updated to "${status}" for ${orgId}`);
  } catch (error: any) {
    console.error("Failed to update organization status in MongoDB");

    throw ApplicationFailure.create({
      message: `Failed to update organization status in MongoDB for orgId ${orgId}. ${error.message}`,
      type: "MongoUpdateFailure",
      nonRetryable: false,
    });
  }
};

export const updateOrganizationInAuth0 = async (
  orgId?: string,
  name?: string,
  identifier?: string
): Promise<void> => {
  try {
    await connectDB();

    const org = await Organization.findById(orgId);

    if (!org || !org.auth0Id) {
      throw ApplicationFailure.create({
        message: `Organization or Auth0 ID not found for orgId: ${orgId}`,
        type: "MissingAuth0ID",
        nonRetryable: true,
      });
    }
    const token = await getAuth0Token();

    const updatePayload: any = {};
    if (name) updatePayload.display_name = name;
    if (identifier) updatePayload.name = identifier;

    if (Object.keys(updatePayload).length === 0) {
      console.log("No fields to update in Auth0.");
      return;
    }

    const response = await axios.patch(
      `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations/${org.auth0Id}`,
      updatePayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Organization updated in Auth0", response.data);

    const dbUpdate: any = {};
    if (name) dbUpdate.name = name;
    if (identifier) dbUpdate.identifier = identifier;

    await Organization.findByIdAndUpdate(orgId, dbUpdate, { new: true });

    console.log("Organization updated in MongoDB", dbUpdate);
  } catch (error: any) {
    let errorMessage = `Failed to update organization (orgId: ${orgId})`;

    if (axios.isAxiosError(error) && error.response) {
      const status = error.response?.status ?? 0;
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
        " — No response received from Auth0. Possible network issue or invalid domain.";

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "NetworkError",
        nonRetryable: false,
      });
    } else {
      errorMessage += ` — Error setting up request: ${
        error?.message || "Unknown error"
      }`;

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "GenericUpdateFailure",
        nonRetryable: true,
      });
    }
  }
};

export const updateOrganizationInDB = async (
  orgId: string,
  updates: Partial<{ name: string; identifier: string; createdByEmail: string }>
): Promise<void> => {
  await connectDB();
  try {
    const result = await Organization.findByIdAndUpdate(orgId, updates, {
      new: true,
    });
    if (!result) {
      throw ApplicationFailure.create({
        message: `Organization not found with the orgId: ${orgId}`,
        type: "MongoUpdateError",
        nonRetryable: true,
      });
    }
    console.log(`Updated organization in MongoDB: ${orgId} with`, updates);
  } catch (error: any) {
    throw ApplicationFailure.create({
      message: `Failed to update organization in MongoDB for orgId ${orgId}. ${error.message}`,
      type: "MongoUpdateFailure",
      nonRetryable: false,
    });
  }
};

export const getOrganizationNameById = async (
  orgId: string
): Promise<string | null> => {
  try {
    await connectDB();
    const org = await Organization.findById(orgId);

    if (!org) {
      throw ApplicationFailure.create({
        message: `Organization not found for orgId: ${orgId}`,
        type: "MongoNotFoundError",
        nonRetryable: true,
      });
    }
    return org.name;
  } catch (error: any) {
    throw ApplicationFailure.create({
      message: `Failed to fetch organization name for orgId: ${orgId}. ${error.message}`,
      type: "MongoReadError",
      nonRetryable: false,
    });
  }
};

// delete organization in auth0
export const deleteOrganizationInAuth0 = async (
  orgId: string
): Promise<void> => {
  try {
    await connectDB();

    const token = await getAuth0Token();

    const org = await Organization.findById(orgId);

    if (!org || !org.auth0Id) {
      throw ApplicationFailure.create({
        message: `Organization or Auth0 ID not found for orgId: ${orgId}`,
        type: "MissingAuth0ID",
        nonRetryable: true,
      });
    }

    console.log("Auth0Id for deleting organization", org.auth0Id);

    await axios.delete(
      `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations/${org.auth0Id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error: any) {
    let errorMessage = `Failed to delete organization (orgId: ${orgId})`;

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
        " — No response received from Auth0. Possible network issue.";
      throw ApplicationFailure.create({
        message: errorMessage,
        type: "NetworkError",
        nonRetryable: false,
      });
    } else {
      errorMessage += ` — Error setting up request: ${
        error.message || "Unknown error"
      }`;

      throw ApplicationFailure.create({
        message: errorMessage,
        type: "GenericDeleteFailure",
        nonRetryable: true,
      });
    }
  }
};

export const deleteOrganizationFromDB = async (
  orgId: string
): Promise<void> => {
  try {
    await connectDB();

    const deletedOrg = await Organization.findByIdAndDelete(orgId);
    if (!deletedOrg) {
      throw ApplicationFailure.create({
        message: `Organization not found with orgId: ${orgId}`,
        type: "MongoDeleteError",
        nonRetryable: true,
      });
    }

    console.log(` Deleted organization from MongoDB: ${orgId}`);
  } catch (error: any) {
    console.error("Error deleting organization from MongoDB:", error);

    throw ApplicationFailure.create({
      message: `Failed to hard delete organization from MongoDB. ${error.message}`,
      type: "MongoDeleteFailure",
      nonRetryable: false,
    });
  }
};

export const listOrganizationFromAuth0 = async (): Promise<any[]> => {
  try {
    const token = await getAuth0Token();

    const response = await axios.get(
      `https://${process.env.AUTH0_ORG_DOMAIN}/api/v2/organizations`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    const status = error.response?.status;
    const isNonRetryable = status >= 400 && status < 500;
    if (isNonRetryable) {
      throw ApplicationFailure.create({
        nonRetryable: true,
        message: "Sending email to User Activity failed",
        details: [
          error.response?.data
            ? JSON.stringify(error.response.data)
            : undefined,
        ],
      });
    } else {
      throw error;
    }
  }
};
