import { Worker } from "@temporalio/worker";
import * as activities from "./activities/activities";
// import { createOrganizationWorkflow } from "./workflows";
import * as workflows from "./workflows";

async function run() {
  const worker = await Worker.create({
    workflowsPath: new URL("./workflows", import.meta.url).pathname,
    activities,
    taskQueue: "organization-task-queue",
  });
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
});
