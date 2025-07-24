import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "../../activities/userActivities.js";

const { listUsersFromAuth0 } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: {
    maximumAttempts: 5,
    initialInterval: "2s",
    backoffCoefficient: 2,
    maximumInterval: "30s",
    nonRetryableErrorTypes: ["Auth0ClientError", "GenericListFailure"],
  },
});

export async function listUserWorkflow(): Promise<any[]> {
  try {
    const users = await listUsersFromAuth0();
    return users;
  } catch (error) {
    console.error("List users workflow failed:", error);
    throw error;
  }
}
