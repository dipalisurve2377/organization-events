import { triggerCreateOrganization } from "../workflows/triggerCreateOrganization.ts";
import { triggerUpdateOrganization } from "../workflows/triggerUpdateOrganization.ts";
import { triggerDeleteOrganization } from "../workflows/triggerDeleteOrganization.ts";
import { sendUpdateSignalToOrgWorkflow } from "../workflows/sendUpdateSignalToOrgWorkflow.ts";
import { sendTerminateSignalToOrgWorkflow } from "../workflows/sendTerminateSignalToOrgWorkflow.ts";
import { sendCancelSignalToOrgWorkflow } from "../workflows/sendCancelSignalToOrgWorkflow.ts";
import Organization from "../models/Organization.js";

export const createOrganizationController = async (req, res) => {
  const { name, identifier, createdByEmail } = req.body;

  if (!name || !identifier || !createdByEmail) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // const existing = await Organization.findOne({ identifier });

    // if (existing) {
    //   return res
    //     .status(400)
    //     .json({ error: "Organization with this identifier already exists." });
    // }
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
    console.error("ERROR STARTING WORKFLOW:");
    console.error(error);
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

// controller to trigger signal

export const sendUpdateSignalController = async (req, res) => {
  const { workflowId, updatedFields } = req.body;

  if (!workflowId || !updatedFields) {
    return res
      .status(400)
      .json({ error: "workflowId and updatedFields are required" });
  }

  try {
    await sendUpdateSignalToOrgWorkflow({ workflowId, updatedFields });
    res.status(200).json({ message: "Signal sent to workflow successfully" });
  } catch (error) {
    console.error("Error sending signal to workflow:", error);
    res.status(500).json({ error: "Failed to send signal to workflow" });
  }
};

// controller to trigger terminate signal

export const sendTerminateSignalController = async (req, res) => {
  const { workflowId } = req.body;

  if (!workflowId) {
    return res
      .status(400)
      .json({ error: "workflowId is required to send terminate signal" });
  }

  try {
    await sendTerminateSignalToOrgWorkflow({ workflowId });
    res.status(200).json({ message: "Terminate signal sent successfully" });
  } catch (error) {
    console.error("Error sending terminate signal:", error);
    res.status(500).json({ error: "Failed to send terminate signal" });
  }
};

// controller to cancel workflow

export const sendCancelSignalController = async (req, res) => {
  const { workflowId } = req.body;

  if (!workflowId) {
    return res.status(400).json({ error: "workflowId is required" });
  }

  try {
    await sendCancelSignalToOrgWorkflow({ workflowId });
    res
      .status(200)
      .json({ message: "Cancel signal sent to workflow successfully" });
  } catch (error) {
    console.error("Error sending cancel signal to workflow:", error);
    res.status(500).json({ error: "Failed to send cancel signal to workflow" });
  }
};
