import { triggerCreateOrganization } from "../workflows/organizationWorkflowsTrigger/triggerCreateOrganization.ts";
import { triggerUpdateOrganization } from "../workflows/organizationWorkflowsTrigger/triggerUpdateOrganization.ts";
import { triggerDeleteOrganization } from "../workflows/organizationWorkflowsTrigger/triggerDeleteOrganization.ts";
import { triggerListOrganizations } from "../workflows/organizationWorkflowsTrigger/triggerListOrganizations.ts";
import { sendUpdateSignalToOrgWorkflow } from "../workflows/organizationWorkflowsTrigger/sendUpdateSignalToOrgWorkflow.ts";
import { sendTerminateSignalToOrgWorkflow } from "../workflows/organizationWorkflowsTrigger/sendTerminateSignalToOrgWorkflow.ts";
import { sendCancelSignalToOrgWorkflow } from "../workflows/organizationWorkflowsTrigger/sendCancelSignalToOrgWorkflow.ts";
import Organization from "../models/Organization.js";

export const createOrganizationController = async (req, res) => {
  const { name, identifier, createdByEmail } = req.body;

  if (!name || !identifier || !createdByEmail) {
    return res
      .status(400)
      .json({ error: `All fields are required.`, statusCode: 400 });
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
    console.error("ERROR STARTING WORKFLOW:");
    console.error(error);
    res.status(500).json({
      error: "Failed to start organization creation workflow",
      statusCode: 500,
    });
  }
};

export const updateOrganizationController = async (req, res) => {
  const orgId = req.params.id;

  const { name, identifier } = req.body;

  if (!orgId || orgId == "undefined") {
    return res
      .status(404)
      .json({ error: "Organization ID is required", statusCode: 404 });
  }

  try {
    const organization = await Organization.findById(orgId);

    if (!organization) {
      return res
        .status(404)
        .json({ error: "Organization not found", statusCode: 404 });
    }

    const { createdByEmail } = organization;

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
  const orgId = req.params.id;

  if (!orgId || orgId == "undefined") {
    return res
      .status(400)
      .json({ error: "orgId is required", statusCode: 400 });
  }

  try {
    const organization = await Organization.findById(orgId);

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    const { name, createdByEmail } = organization;

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

// controller for list of organizations

export const listOrganizationController = async (req, res) => {
  try {
    const dbOrganizations = await Organization.find({});
    const organizations = await triggerListOrganizations();

    const cleanedOrganizations = organizations.map((org) => ({
      name: org.display_name,
      identifier: org.name,
      orgId: org.id,
      createdAt: org.created_at,
    }));

    res.status(200).json({ organizations: dbOrganizations });
  } catch (error) {
    console.error("Error listing organizations:", error);
    res.status(500).json({ error: "Failed to fetch organizations from Auth0" });
  }
};

// controller to trigger signal

export const sendUpdateSignalController = async (req, res) => {
  const workflowId = req.params.id;
  const { updatedFields } = req.body;

  if (!workflowId || !updatedFields) {
    console.log("workflowId and updatedFields are required");
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
  const workflowId = req.params.id;

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
  const workflowId = req.params.id;
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
