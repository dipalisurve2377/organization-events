import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/activities.ts";
import { sleep } from "@temporalio/workflow";
import { ApplicationFailure } from "@temporalio/workflow";
import { defineSignal, setHandler } from "@temporalio/workflow";

// defining signal for the update workflow payload
export const updateOrgPayloadSignal =
  defineSignal<[Partial<CreateOrganizationInput>]>("updateOrgDetails");

// defining signal for the terminate existing workflow

export const terminateWorkflowSignal = defineSignal<[]>("terminateWorkflow");

// defining signal for the cancle workflow

export const cancelWorkflowSignal = defineSignal("cancelWorkflow");

let shouldTerminate = false;

export interface CreateOrganizationInput {
  orgId: string;
  name: string;
  identifier: string;
  createdByEmail: string;
}

// This is the Activity Definition
const {
  createOrganizationInAuth0,
  sendNotificationEmail,
  updateOrganizationStatus,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 seconds",
  retry: {
    maximumAttempts: 5,
    initialInterval: "2s",
    backoffCoefficient: 2,
    maximumInterval: "10s",
  },
});

export async function createOrganizationWorkflow(
  input: CreateOrganizationInput
): Promise<void> {
  let currentInput = { ...input };

  // handler for the update signal
  setHandler(updateOrgPayloadSignal, (updatedFields) => {
    console.log("Signal received with updated feilds", updatedFields);

    currentInput = { ...currentInput, ...updatedFields };
  });

  // handler for terminate workflow
  setHandler(terminateWorkflowSignal, () => {
    console.log("Terminate signal received");
    shouldTerminate = true;
  });

  // handler for the cancel workflow

  let shouldCancel = false;

  setHandler(cancelWorkflowSignal, () => {
    console.log("Cancel signal received. Workflow will exit.");
    shouldCancel = true;
  });

  const { orgId, name, identifier, createdByEmail } = input;

  try {
    console.log("Creating organization with input:", currentInput);

    await createOrganizationInAuth0(name, identifier, createdByEmail);

    await sendNotificationEmail(createdByEmail, name);

    await sleep("20 seconds");
    await updateOrganizationStatus(orgId, "success");

    //--------------------------------------------Update Signal--------------------------------

    await sleep("60 seconds"); // enable for update signal testing

    //--------------------------------------------Termination Signal--------------------------------
    // Check for termination in loop
    for (let i = 0; i < 60; i++) {
      if (shouldTerminate) {
        console.log("Workflow terminated early via signal.");
        return;
      }
      await sleep("1s");
    }

    //--------------------------------------------Cancel Signal--------------------------------

    for (let i = 0; i < 60; i++) {
      if (shouldCancel) {
        console.log("Workflow canceled by signal.");
        return;
      }
      await sleep("1s");
    }

    console.log("Final updated input after signals:", currentInput);
  } catch (error: any) {
    console.error("Workflow failed:", error);

    if (error instanceof ApplicationFailure && error.nonRetryable) {
      await updateOrganizationStatus(orgId, "failed");
    } else {
      await updateOrganizationStatus(orgId, "failed");
    }

    throw error;
  }
}
