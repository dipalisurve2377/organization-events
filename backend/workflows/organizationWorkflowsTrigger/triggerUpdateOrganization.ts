import { getTemporalClient } from "../../client";

export interface UpdateOrganizationInput {
  orgId: string;
  name?: string;
  identifier?: string;
  createdByEmail: string;
}

export const triggerUpdateOrganization = async (
  input: UpdateOrganizationInput
) => {
  const client = await getTemporalClient();

  const handle = await client.start("updateOrganizationWorkflow", {
    taskQueue: "organization-task-queue",
    workflowId: `update-org-${input.orgId}`,
    args: [input],
    retry: {
      maximumAttempts: 3,
      initialInterval: "5s",
      backoffCoefficient: 2,
      maximumInterval: "30s",
      nonRetryableErrorTypes: [
        "Auth0ClientError",
        "MissingAuth0ID",
        "GenericUpdateFailure",
      ],
    },
  });

  console.log(`Started update workflow: ${handle.workflowId}`);

  return handle.workflowId;
};
