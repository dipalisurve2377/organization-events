import mongoose, { Error } from "mongoose";
import nodemailer from "nodemailer";
import { getAuth0Token } from "../auth0Service";
import dotenv from "dotenv";
import axios, { AxiosError } from "axios";
import { request } from "http";
import { ApplicationFailure } from "@temporalio/client";

dotenv.config();

let connected = false;

const connectDB = async () => {
  if (!connected) {
    await mongoose.connect(process.env.MONGO_URI as string);
    connected = true;
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
): Promise<void> => {
  try {
    const token = await getAuth0Token();

    console.log("Sending organization to Auth0", {
      name,
      identifier,
      createdByEmail,
    });

    const orgRes = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/organizations`,
      {
        display_name: name,
        name: identifier,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("Organization created in Auth0", orgRes.data);

    const auth0Id = orgRes.data.id;

    await connectDB();

    await Organization.findOneAndUpdate(
      { identifier },
      { auth0Id },
      { new: true }
    );

    console.log(
      `Auth0 ID saved to db for identifier ${identifier} : ${auth0Id}`
    );

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

// update the organization status

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
  await connectDB();

  const update: any = { status };

  if (auth0Id) update.auth0Id = auth0Id;
  if (name) update.name = name;

  await Organization.findByIdAndUpdate(orgId, update, { new: true });

  console.log(`Organization status updated to "${status}" for ${orgId}`);
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
      `https://${process.env.AUTH0_DOMAIN}/api/v2/organizations/${org.auth0Id}`,
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

// delete organization in auth0

export const getOrganizationNameById = async (
  orgId: string
): Promise<string | null> => {
  await connectDB();
  const org = await Organization.findById(orgId);
  return org?.name || null;
};

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
      `https://${process.env.AUTH0_DOMAIN}/api/v2/organizations/${org.auth0Id}`,
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
