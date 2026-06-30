import { defineConfig } from "@trigger.dev/sdk/v3";
import dotenv from "dotenv";

dotenv.config();
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
