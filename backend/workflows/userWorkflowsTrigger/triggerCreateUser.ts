import { getTemporalClient } from "../../client";

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
}

export const triggerCreateUser = async (input: CreateUserInput) => {
  const client = await getTemporalClient();

  const handle = await client.start("createUserWorkflow", {
    taskQueue: "user-management-queue",
    workflowId: `create-user-${input.email}`,
    args: [input],
    //  startDelay:'4 minutes'
    // cronSchedule: " 45 10 14 7 1",
    retry: {
      maximumAttempts: 3,
      initialInterval: "5s",
      backoffCoefficient: 2,
      maximumInterval: "60s",
    },
  });

  console.log(`Started workflow ${handle.workflowId}`);
  return handle.workflowId;
};
