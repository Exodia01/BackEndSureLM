import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts", "tests/**/*.test.ts"],
    // Live smoke test against the separately-running localhost:3000 instance.
    // Excluded from the standard suite; run it explicitly via `npm run test:api-auth`.
    exclude: [...configDefaults.exclude, "test/api-auth.test.ts"],
    testTimeout: 60000,
    setupFiles: ["./test/SetupKeycloak.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
