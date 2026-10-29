import "dotenv/config";
import { readWorkerConfig } from "@/worker/config";
import { runWorker } from "@/worker/run";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required to run the worker.");
  process.exit(1);
}

const config = readWorkerConfig();

runWorker(config)
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "The worker stopped.");
    process.exitCode = 1;
  });
