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
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 seconds",
  retry: {
    maximumAttempts: 5,
    initialInterval: "2s",
    backoffCoefficient: 2,
    maximumInterval: "10s",
  },
});

export async function createOrganizationWorkflow(
  input: CreateOrganizationInput
): Promise<void> {
  const { orgId, name, identifier, createdByEmail } = input;

  try {
    const auth0Id = await createOrganizationInAuth0(
      name,
      identifier,
      createdByEmail
    );

    await saveAuth0IdToMongoDB(identifier, auth0Id);

    await sleep("20 seconds");
    await updateOrganizationStatus(orgId, "success");

    await sendNotificationEmail(createdByEmail, name);
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
