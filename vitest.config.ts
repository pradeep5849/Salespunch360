import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    maxWorkers: 4,
    coverage: {
      provider: "v8",
      include: [
        "src/lib/account/money-ledger.ts",
        "src/lib/account/inventory-policy.ts",
        "src/lib/logging.ts",
        "src/lib/security/headers.ts",
        "src/lib/auth/workspace-policy.ts",
        "src/lib/auth/permissions.ts",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 90,
        lines: 85,
        branches: 80,
        functions: 85,
        perFile: true,
      },
    },
    exclude: ["e2e/**", "node_modules/**"],
    env: {
      DIRECT_URL: "postgresql://test:test@localhost:5432/salespunch360_test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/salespunch360_test",
      AUTH_SECRET: "vitest-only-secret-at-least-thirty-two-characters",
    },
  },
});
