import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../../activities/organizationActivities.js";

export interface sendNotificationEmailInput {
  to: string;
  name: string;
  action?: "created" | "deleted" | "updated";
}

const { sendNotificationEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
});

export async function sendNotificationEmailWorkflow(
  input: sendNotificationEmailInput
): Promise<void> {
  const { to, name, action = "created" } = input;
  await sendNotificationEmail(to, name, action);
}
