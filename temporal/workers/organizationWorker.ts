import { Worker } from "@temporalio/worker";
import * as activities from "../activities/organizationActivities";

import * as workflows from "../workflows/organizationWorkflows";

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve("../workflows/organizationWorkflows"),
    activities,
    taskQueue: "organization-task-queue",
  });
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
});
