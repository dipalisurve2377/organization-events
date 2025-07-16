import { getTemporalClient } from "../../temporal/client";

import { cancelWorkflowSignal } from "../../temporal/workflows/createOrganizationWorkflow";

interface CancelSignalInput {
  workflowId: string;
}

export const sendCancelSignalToOrgWorkflow = async ({
  workflowId,
}: CancelSignalInput): Promise<void> => {
  const client = await getTemporalClient();

  const handle = client.getHandle(workflowId);

  console.log("Sending cancel signal to workflowId: ", workflowId);

  await handle.cancel();

  console.log("Workflow canceled:", workflowId);
};
