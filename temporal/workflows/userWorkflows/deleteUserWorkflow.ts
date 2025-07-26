import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "../../activities/userActivities.js";

const { deleteUserFromAuth0, deleteUserFromDB, updateUserStatus, getUserInfo } =
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

    // Get user info to check if Auth0 ID exists
    const userInfo = await getUserInfo(email);

    if (
      userInfo &&
      userInfo.auth0Id &&
      userInfo.status !== "failed" &&
      userInfo.status !== "provisioning"
    ) {
      // Auth0 ID exists and user is not in failed/provisioning state
      // Delete from both Auth0 and DB
      await deleteUserFromAuth0(email);
      await deleteUserFromDB(userId);
    } else {
      // Auth0 ID doesn't exist or user is in failed/provisioning state
      // Delete only from DB
      console.log(
        `User ${email} has no Auth0 ID or is in failed/provisioning state. Deleting only from DB.`
      );
      await deleteUserFromDB(userId);
    }
  } catch (error) {
    console.error("Delete workflow failed:", error);
    await updateUserStatus(email, "failed");
    throw error;
  }
}
