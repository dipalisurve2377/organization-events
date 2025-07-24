import { getTemporalClient } from "../../client";

export const triggerListOrganizations = async () => {
  const client = await getTemporalClient();

  const handle = await client.start("listOrganizationWorkflow", {
    taskQueue: "organization-task-queue",
    workflowId: `list-organizations-${Date.now()}`,
    args: [],
    retry: {
      maximumAttempts: 3,
      initialInterval: "5s",
      backoffCoefficient: 2,
      maximumInterval: "30s",
      nonRetryableErrorTypes: ["Auth0ClientError", "GenericListFailure"],
    },
  });
  console.log(`Started workflow ${handle.workflowId}`);

  const result = await handle.result();
  return result;
};
