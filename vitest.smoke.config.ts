import { defineConfig } from "vitest/config";
import path from "path";

// Dedicated config for the live API smoke test (test/api-auth.test.ts).
// Run with `npm run test:api-auth` against the separately-running localhost:3000 instance.
// This test is excluded from the standard suite (see vitest.config.ts).
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/api-auth.test.ts"],
    exclude: [],
    testTimeout: 60000,
    setupFiles: ["./test/SetupKeycloak.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
