import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
  project: "proj_cxnpprlinngvttlkvwgr", 
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
  build: {
    extensions: [
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma",
        directUrlEnvVarName: "DATABASE_URL",
      }),
    ],
  },
});