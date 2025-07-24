import { getTemporalClient } from "../../client.js";

export interface CreateOrganizationInput {
  orgId: string;
  name: string;
  identifier: string;
  createdByEmail: string;
}

export const triggerCreateOrganization = async (
  input: CreateOrganizationInput
) => {
  const client = await getTemporalClient();

  const handle = await client.start("createOrganizationWorkflow", {
    taskQueue: "organization-task-queue",
    workflowId: `create-org-${input.identifier}`,
    args: [input],
    retry: {
      maximumAttempts: 3,
      initialInterval: "5s",
      backoffCoefficient: 2,
      maximumInterval: "30s",
      nonRetryableErrorTypes: ["Auth0ClientError"],
    },
  });

  console.log(`Started workflow : ${handle.workflowId}`);
  return handle.workflowId;
};
