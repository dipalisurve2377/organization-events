import { getTemporalClient } from "../../client";

interface TerminateSignalInput {
  workflowId: string;
}

export const sendTerminateSignalToOrgWorkflow = async ({
  workflowId,
}: TerminateSignalInput): Promise<void> => {
  const client = await getTemporalClient();

  const handle = client.getHandle(workflowId);

  console.log("Sending terminate signal to workflowId: ", workflowId);

  await handle.signal("terminateWorkflowSignal");

  await handle.terminate("Terminated by user request");

  console.log("Workflow terminated:", workflowId);
};
