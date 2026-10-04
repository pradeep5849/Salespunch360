import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";
// Initial measured baseline across all web source. Ratchet upward as executable
// regression tests replace or complement historical source-contract assertions.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      coverage: {
        include: ["src/**/*.{ts,tsx}"],
        reportsDirectory: "coverage/global",
        reporter: ["text-summary", "json-summary"],
        thresholds: {
          perFile: false,
          statements: 28,
          lines: 29,
          branches: 24,
          functions: 25,
        },
      },
    },
  }),
);
