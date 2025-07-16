import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/activities.ts";

const { listOrganizationFromAuth0 } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: {
    maximumAttempts: 5,
    initialInterval: "2s",
    backoffCoefficient: 2,
    maximumInterval: "30s",
    nonRetryableErrorTypes: ["Auth0ClientError", "GenericListFailure"],
  },
});

export async function listOrganizationWorkflow(): Promise<any[]> {
  try {
    const orgs = await listOrganizationFromAuth0();
    return orgs;
  } catch (error) {
    console.error("List organizations workflow failed:", error);
    throw error;
  }
}
