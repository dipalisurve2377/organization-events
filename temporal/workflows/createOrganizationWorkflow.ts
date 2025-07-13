import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/activities.ts";
import { sleep } from "@temporalio/workflow";

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
  } catch (error) {
    console.error("Workflow failed:", error);
  }
}
