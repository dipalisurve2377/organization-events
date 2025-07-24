import { Worker, NativeConnection } from "@temporalio/worker";
import * as activities from "../activities/userActivities.js";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const connection = await NativeConnection.connect({ address: "temporal:7233" });
const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  const worker = await Worker.create({
    workflowsPath: resolve(__dirname, "../workflows/userWorkflows"),
    activities,
    taskQueue: "user-management-queue",
    connection,
  });
  console.log("Worker started on task queue : user-management-queue");
  await worker.run();
}

run().catch((err) => {
  console.error("Worker failed", err);
  process.exit(1);
});
