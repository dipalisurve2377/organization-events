import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../../activities/organizationActivities";

export interface SendNotificationEmailInput {
  to: string;
  name: string;
  action?: "created" | "updated" | "deleted" | "cancelled" | "failed";
}

const { sendNotificationEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 seconds",
  retry: {
    maximumAttempts: 5,
    initialInterval: "2s",
    backoffCoefficient: 2,
    maximumInterval: "10s",
  },
});

export async function sendNotificationEmailWorkflow(input: SendNotificationEmailInput): Promise<void> {
  const { to, name, action = "created" } = input;
  await sendNotificationEmail(to, name, action);
}