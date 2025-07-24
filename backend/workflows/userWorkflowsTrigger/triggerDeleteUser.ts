import { getTemporalClient } from "../../client";

export interface DeleteUserInput {
  email: string;
  userId: string;
}

export const triggerDeleteUser = async (input: DeleteUserInput) => {
  const client = await getTemporalClient();

  const handle = await client.start("deleteUserWorkflow", {
    taskQueue: "user-management-queue",
    workflowId: `delete-user-${input.email}`,
    args: [input],
    retry: {
      maximumAttempts: 3,
      initialInterval: "5s",
      backoffCoefficient: 2,
      maximumInterval: "30s",
      nonRetryableErrorTypes: [
        "MissingAuth0ID",
        "Auth0ClientError",
        "GenericDeleteFailure",
      ],
    },
  });

  console.log(`Started delete user workflow ${handle.workflowId}`);
  return handle.workflowId;
};
