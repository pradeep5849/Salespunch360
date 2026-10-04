import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
it.each([
  { DIRECT_URL: "postgresql://user:never-print-this@production.example/live" },
  { DIRECT_URL: "postgresql://user:never-print-this@127.0.0.1/live" },
  { DIRECT_URL: "not-a-url-never-print-this" },
  {
    DIRECT_URL: "postgresql://ci:ci@localhost/application_ci",
    RESTORE_DRILL_DATABASE_URL:
      "postgresql://user:never-print-this@production.example/target_restore_drill",
  },
])(
  "refuses non-isolated recovery targets without exposing connection values",
  (overrides) => {
    const result = spawnSync(process.execPath, ["scripts/recovery-drill.mjs"], {
      encoding: "utf8",
      env: {
        ...process.env,
        RESTORE_DRILL_DATABASE_URL:
          "postgresql://ci:ci@localhost/application_restore_drill",
        ...overrides,
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("isolated local database");
    expect(result.stderr).not.toContain("never-print-this");
  },
);
