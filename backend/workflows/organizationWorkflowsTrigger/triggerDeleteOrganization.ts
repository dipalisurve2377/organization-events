import { getTemporalClient } from "../../client";

export interface DeleteOrganizationInput {
  orgId: string;
  createdByEmail: string;
  name?: string;
}
export const triggerDeleteOrganization = async (
  input: DeleteOrganizationInput
) => {
  const client = await getTemporalClient();

  const handle = await client.start("deleteOrganizationWorkflow", {
    taskQueue: "organization-task-queue",
    workflowId: `delete-org-${input.orgId}`,
    args: [input],
    retry: {
      maximumAttempts: 3,
      initialInterval: "3s",
      backoffCoefficient: 2,
      maximumInterval: "1m",
      nonRetryableErrorTypes: [
        "Auth0ClientError",
        "MissingAuth0ID",
        "GenericDeleteFailure",
      ],
    },
  });

  console.log(`Started delete workflow : ${handle.workflowId}`);

  return handle.workflowId;
};
