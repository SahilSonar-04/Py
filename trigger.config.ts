import { defineConfig } from "@trigger.dev/sdk/v3";
import dotenv from "dotenv";

dotenv.config();

const projectId = process.env.TRIGGER_PROJECT_ID;
if (!projectId) {
  throw new Error(
    "TRIGGER_PROJECT_ID is not set. This must be present in the environment " +
      "that runs the Trigger.dev CLI (`trigger.dev dev` / `trigger.dev deploy`), " +
      "which is separate from your Vercel project's env vars. Set it in your " +
      "local .env (for dev) and in whatever shell/CI runs `trigger.dev deploy` " +
      "(for production)."
  );
}

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID  || "Project_Undefined",
  runtime: "node",
  logLevel: "log",
  maxDuration: 120, // seconds - covers the mandatory 30s+ Crop Image delay comfortably
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
