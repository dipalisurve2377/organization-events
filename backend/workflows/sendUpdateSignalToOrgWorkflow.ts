import { getTemporalClient } from "../../temporal/client";
import { updateOrgPayloadSignal } from "../../temporal/workflows/createOrganizationWorkflow";

interface UpdatePayloadInput {
  workflowId: string;
  updatedFields: Partial<{
    name: string;
    identifier: string;
    createdByEmail: string;
  }>;
}

export const sendUpdateSignalToOrgWorkflow = async ({
  workflowId,
  updatedFields,
}: UpdatePayloadInput): Promise<void> => {
  const client = await getTemporalClient();

  const handle = client.getHandle(workflowId);

  console.log(" Getting handle for workflowId:", workflowId);

  await handle.signal(updateOrgPayloadSignal, updatedFields);

  console.log(`Signal sent to ${workflowId} with:`, updatedFields);
};
