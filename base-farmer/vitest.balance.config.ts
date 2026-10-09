import { defineConfig } from "vitest/config";

/** `npm run balance` / `npm run perf`: long measurement runs, kept out of the regular test run. */
export default defineConfig({
  test: {
    include: ["src/tools/*.run.ts"],
    environment: "node",
  },
});
