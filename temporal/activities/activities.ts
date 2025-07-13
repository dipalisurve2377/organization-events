import mongoose, { Error } from "mongoose";
import nodemailer from "nodemailer";
import { getAuth0Token } from "../auth0Service";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

let connected = false;

const connectDB = async () => {
  if (!connected) {
    await mongoose.connect(
      process.env.MONGO_URI ||
        "mongodb+srv://dipali:organization2000@cluster0.l9sxobd.mongodb.net/"
    );
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
      `https://dev-kfmfhnq5hivv164x.us.auth0.com/api/v2/organizations`,
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
    console.error(
      "Failed to create organization in Auth0:",
      error.response?.data || error.message
    );

    throw new Error("Auth0 organization creation failed");
  }
};

// sending email to the user

export const sendNotificationEmail = async (
  to: string,
  name: string,
  action: "created" | "updated" | "deleted" = "created"
): Promise<void> => {
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
    | "deleted",
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
      throw new Error("Organization or Auth0 ID not found");
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
      `https://dev-kfmfhnq5hivv164x.us.auth0.com/api/v2/organizations/${org.auth0Id}`,
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
    console.error(
      "Failed to update Organization in Auth0",
      error.response?.data || error.message
    );
    throw new Error("Auth0 organization update failed");
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
  await connectDB();

  const token = await getAuth0Token();

  const org = await Organization.findById(orgId);
  console.log("Auth0Id for deleting organization", org.auth0Id);

  await axios.delete(
    `https://dev-kfmfhnq5hivv164x.us.auth0.com/api/v2/organizations/${org.auth0Id}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};
