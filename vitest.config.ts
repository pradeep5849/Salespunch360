import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { env: { DATABASE_URL: "postgresql://test:test@localhost:5432/salespunch360_test", AUTH_SECRET: "vitest-only-secret-at-least-thirty-two-characters" } },
});
