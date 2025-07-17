import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../../activities/userActivities.ts";
import { sleep } from "@temporalio/workflow";
import { ApplicationFailure } from "@temporalio/workflow";

const { createUserInAuth0, saveAuth0IdToMongoDB, updateUserStatus } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "20 seconds",
    retry: {
      maximumAttempts: 5,
      initialInterval: "2s",
      backoffCoefficient: 2,
      maximumInterval: "30s",
      nonRetryableErrorTypes: ["Auth0ClientError", "GenericCreateFailure"],
    },
  });

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
}

export async function createUserWorkflow({
  email,
  password,
  name,
}: CreateUserInput): Promise<void> {
  try {
    const auth0id = await createUserInAuth0(email, password, name);
    await saveAuth0IdToMongoDB(email, auth0id);
    await sleep("20 seconds");

    await updateUserStatus(email, "success", auth0id, name);
  } catch (error) {
    console.error("CreateUserWorkflow failed", error);

    await updateUserStatus(email, "failed");

    if (error instanceof ApplicationFailure) {
      console.error("ApplicationFailure type:", error.type);
    }

    throw error;
  }
}
