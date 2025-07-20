import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../../activities/organizationActivities.ts";
import { sleep } from "@temporalio/workflow";
import { ApplicationFailure } from "@temporalio/workflow";
import { defineSignal, setHandler } from "@temporalio/workflow";

// defining signal for the update workflow payload
export const updateOrgPayloadSignal =
  defineSignal<[Partial<CreateOrganizationInput>]>("updateOrgDetails");

// defining signal for the terminate existing workflow

export const terminateWorkflowSignal = defineSignal<[]>("terminateWorkflow");

// defining signal for the cancle workflow

export const cancelWorkflowSignal = defineSignal("cancelWorkflow");

export interface CreateOrganizationInput {
  orgId: string;
  name: string;
  identifier: string;
  createdByEmail: string;
}

// This is the Activity Definition
const {
  createOrganizationInAuth0,
  saveAuth0IdToMongoDB,
  sendNotificationEmail,
  updateOrganizationStatus,
  updateOrganizationInDB,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 seconds",
  retry: {
    maximumAttempts: 5,
    initialInterval: "2s",
    backoffCoefficient: 2,
    maximumInterval: "10s",
  },
});

let shouldTerminate = false;
let shouldCancel = false;
let updatedFields: Partial<CreateOrganizationInput> | null = null;

export async function createOrganizationWorkflow(
  input: CreateOrganizationInput
): Promise<void> {
  // handler for terminate workflow
  setHandler(terminateWorkflowSignal, () => {
    console.log("Terminate signal received");
    shouldTerminate = true;
  });

  // handler for the cancel workflow

  setHandler(cancelWorkflowSignal, () => {
    console.log("Cancel signal received. Workflow will exit.");
    shouldCancel = true;
  });

  // handler for update organization details
  setHandler(
    updateOrgPayloadSignal,
    (fields: Partial<CreateOrganizationInput>) => {
      console.log("Update signal received:", fields);
      updatedFields = fields;
    }
  );

  let { orgId, name, identifier, createdByEmail } = input;

  try {
    // Check if we have updated fields and apply them
    if (updatedFields) {
      console.log("Applying updated fields:", updatedFields);
      name = updatedFields.name || name;
      identifier = updatedFields.identifier || identifier;
      createdByEmail = updatedFields.createdByEmail || createdByEmail;
      updatedFields = null; // Reset after applying
    }

    const auth0Id = await createOrganizationInAuth0(
      name,
      identifier,
      createdByEmail
    );

    await saveAuth0IdToMongoDB(identifier, auth0Id);

    await sleep("20 seconds");
    await updateOrganizationStatus(orgId, "success");

    await sendNotificationEmail(createdByEmail, name);

    // Check for termination and updates in loop
    for (let i = 0; i < 60; i++) {
      if (shouldTerminate) {
        console.log("Workflow terminated early via signal.");
        return;
      }
      if (shouldCancel) {
        console.log("Workflow canceled by signal.");
        return;
      }
      if (updatedFields) {
        console.log("Applying updated fields in loop:", updatedFields);
        const fields = updatedFields as Partial<CreateOrganizationInput>;
        if (fields.name) name = fields.name;
        if (fields.identifier) identifier = fields.identifier;
        if (fields.createdByEmail) createdByEmail = fields.createdByEmail;
        await updateOrganizationInDB(orgId, fields);
        updatedFields = null; // Reset after applying
      }
      await sleep("1s");
    }
  } catch (error: any) {
    console.error("Workflow failed:", error);

    if (error instanceof ApplicationFailure && error.nonRetryable) {
      await updateOrganizationStatus(orgId, "failed");
    } else {
      await updateOrganizationStatus(orgId, "failed");
    }

    throw error;
  }
}
