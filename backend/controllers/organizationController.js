import { triggerCreateOrganization } from "../workflows/triggerCreateOrganization.ts";
import { triggerUpdateOrganization } from "../workflows/triggerUpdateOrganization.ts";
import { triggerDeleteOrganization } from "../workflows/triggerDeleteOrganization.ts";

import Organization from "../models/Organization.js";

export const createOrganizationController = async (req, res) => {
  const { name, identifier, createdByEmail } = req.body;

  if (!name || !identifier || !createdByEmail) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const org = await Organization.create({
      name,
      identifier,
      createdByEmail,
      status: "provisioning",
    });

    const workflowId = await triggerCreateOrganization({
      orgId: org._id.toString(),
      name,
      identifier,
      createdByEmail,
    });
    res
      .status(200)
      .json({ message: "Organization provisioning started", workflowId });
  } catch (error) {
    console.error("Error starting organization workflow:", error);
    res
      .status(500)
      .json({ error: "Failed to start organization creation workflow" });
  }
};

export const updateOrganizationController = async (req, res) => {
  const { orgId, name, identifier, createdByEmail } = req.body;

  if (!orgId || !createdByEmail) {
    return res
      .status(400)
      .json({ error: "Organization ID  any createdByEmail is required" });
  }

  try {
    console.log("Calling triggerUpdateOrganization with:", {
      orgId,
      name,
      identifier,
      createdByEmail,
    });
    const workflowId = await triggerUpdateOrganization({
      orgId,
      name,
      identifier,
      createdByEmail,
    });
    res
      .status(200)
      .json({ message: "Organization update started", workflowId });
  } catch (error) {
    console.error("Error starting update workflow:", error);
    res
      .status(500)
      .json({ error: "Failed to start organization update workflow" });
  }
};

export const deleteOrganizationController = async (req, res) => {
  const { orgId, createdByEmail, name } = req.body;

  if (!orgId || !createdByEmail) {
    return res
      .status(400)
      .json({ error: "orgId, name, and createdByEmail are required" });
  }

  try {
    const workflowId = await triggerDeleteOrganization({
      orgId,
      name,
      createdByEmail,
    });
    res.status(200).json({
      message: "Organization deletion started",
      workflowId,
    });
  } catch (error) {
    console.error("Error starting delete workflow:", error);
    res
      .status(500)
      .json({ error: "Failed to start delete organization workflow" });
  }
};
