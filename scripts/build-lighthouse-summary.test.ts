import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

function summarize(report: object, scope?: string) {
  const directory = mkdtempSync(join(tmpdir(), "lighthouse-summary-"));
  const input = join(directory, "report.json");
  const output = join(directory, "summary.json");
  const stdoutPath = join(directory, "stdout.txt");
  const stderrPath = join(directory, "stderr.txt");
  const stdout = openSync(stdoutPath, "w");
  const stderr = openSync(stderrPath, "w");
  try {
    writeFileSync(input, JSON.stringify(report));
    const result = spawnSync(
      process.execPath,
      [
        resolve("scripts/summarize-public-lighthouse.mjs"),
        input,
        output,
        ...(scope ? [scope] : []),
      ],
      { encoding: "utf8", stdio: ["ignore", stdout, stderr] },
    );
    return {
      ...result,
      stdout: readFileSync(stdoutPath, "utf8"),
      stderr: readFileSync(stderrPath, "utf8"),
      summary:
        result.status === 0 ? JSON.parse(readFileSync(output, "utf8")) : null,
    };
  } finally {
    closeSync(stdout);
    closeSync(stderr);
    rmSync(directory, { recursive: true, force: true });
  }
}

const report = {
  finalDisplayedUrl: "http://127.0.0.1:3000/",
  fetchTime: "2026-11-20T10:00:00Z",
  configSettings: { formFactor: "mobile" },
  categories: { performance: { score: 0.9 } },
  audits: {},
};

it("labels local build measurements independently of public measurements", () => {
  const result = summarize(report, "build");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("BUILD_AUDIT_SUMMARY ");
  expect(result.summary).toMatchObject({
    measurementScope: "ci-production-build",
    url: report.finalDisplayedUrl,
    scores: { performance: 90 },
  });
});

it("retains the existing public audit output contract", () => {
  const result = summarize(report);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("PUBLIC_AUDIT_SUMMARY ");
  expect(result.summary).not.toHaveProperty("measurementScope");
});

it("does not publish a successful summary for a failed document request", () => {
  const result = summarize(
    { ...report, runtimeError: { message: "Document returned 403" } },
    "build",
  );
  expect(result.status).not.toBe(0);
  expect(result.summary).toBeNull();
  expect(result.stderr).toContain("Document returned 403");
});
