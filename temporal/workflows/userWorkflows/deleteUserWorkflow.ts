import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "../../activities/userActivities.js";

const { deleteUserFromAuth0, deleteUserFromDB, updateUserStatus } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "10 seconds",
    retry: {
      maximumAttempts: 5,
      initialInterval: "2s",
      backoffCoefficient: 2,
      maximumInterval: "30s",
      nonRetryableErrorTypes: [
        "Auth0ClientError",
        "MissingAuth0ID",
        "GenericDeleteFailure",
      ],
    },
  });

export interface DeleteUserInput {
  email: string;
  userId: string;
}

export async function deleteUserWorkflow({
  email,
  userId,
}: DeleteUserInput): Promise<void> {
  try {
    await updateUserStatus(email, "deleting");
    await deleteUserFromAuth0(email);
    await deleteUserFromDB(userId);
  } catch (error) {
    console.error("Delete workflow failed:", error);
    await updateUserStatus(email, "failed");
    throw error;
  }
}
