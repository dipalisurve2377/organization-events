import { Connection, WorkflowClient } from "@temporalio/client";

export const getTemporalClient = async () => {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || "temporal:7233",
  });

  return new WorkflowClient({ connection });
};
