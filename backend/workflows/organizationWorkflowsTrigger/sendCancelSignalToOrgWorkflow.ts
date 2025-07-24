import { getTemporalClient } from "../../client";

interface CancelSignalInput {
  workflowId: string;
}

export const sendCancelSignalToOrgWorkflow = async ({
  workflowId,
}: CancelSignalInput): Promise<void> => {
  const client = await getTemporalClient();

  const handle = client.getHandle(workflowId);

  console.log("Sending cancel signal to workflowId: ", workflowId);

  handle.signal("cancelWorkflowSignal");

  await handle.cancel();

  console.log("Workflow canceled:", workflowId);
};
