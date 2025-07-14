import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/activities.ts";
import { sleep } from "@temporalio/workflow";
import { ApplicationFailure } from "@temporalio/workflow";

export interface CreateOrganizationInput {
  orgId: string;
  name: string;
  identifier: string;
  createdByEmail: string;
}

const {
  createOrganizationInAuth0,
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
    await createOrganizationInAuth0(name, identifier, createdByEmail);

    await sendNotificationEmail(createdByEmail, name);

    await sleep("20 seconds");
    await updateOrganizationStatus(orgId, "success");
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
