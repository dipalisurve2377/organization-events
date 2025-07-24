import { Worker, NativeConnection } from "@temporalio/worker";
import * as activities from "../activities/organizationActivities.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const connection = await NativeConnection.connect({ address: "temporal:7233" });
const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  const worker = await Worker.create({
    workflowsPath: resolve(__dirname, "../workflows/organizationWorkflows"),
    activities,
    taskQueue: "organization-task-queue",
    connection,
  });
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
