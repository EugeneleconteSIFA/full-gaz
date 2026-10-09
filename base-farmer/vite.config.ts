import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  server: { host: true },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
