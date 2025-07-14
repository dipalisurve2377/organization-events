import { getTemporalClient } from "../../temporal/client";

import {
  DeleteOrganizationInput,
  deleteOrganizationWorkflow,
} from "../../temporal/workflows/deleteOrganizationWorkflow";

export const triggerDeleteOrganization = async (
  input: DeleteOrganizationInput
) => {
  const client = await getTemporalClient();

  const handle = await client.start(deleteOrganizationWorkflow, {
    taskQueue: "organization-task-queue",
    workflowId: `delete-org-${input.orgId}`,
    args: [input],
  });

  console.log(`Started delete workflow : ${handle.workflowId}`);

  return handle.workflowId;
};
