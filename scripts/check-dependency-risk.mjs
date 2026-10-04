import { spawnSync } from "node:child_process";
const accepted = new Set([
  "braces",
  "micromatch",
  "fast-glob",
  "@next/eslint-plugin-next",
  "eslint-config-next",
]);
const audit = spawnSync("npm", ["audit", "--json"], { encoding: "utf8" });
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error("Dependency audit did not return valid results.");
  process.exit(1);
}
if (report.error || !report.vulnerabilities) {
  console.error("Dependency audit unavailable.");
  process.exit(1);
}
const expired = new Date() >= new Date("2026-11-05T00:00:00Z");
let rejected = false,
  known = 0;
for (const [name, finding] of Object.entries(report.vulnerabilities)) {
  if (!["high", "critical"].includes(finding.severity)) continue;
  const knownAdvisories = finding.via.every((item) =>
    typeof item === "string"
      ? accepted.has(item)
      : item.url === "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  );
  const temporarilyAccepted =
    knownAdvisories &&
    !expired &&
    finding.severity === "high" &&
    !finding.isDirect &&
    accepted.has(name);
  // eslint-config-next is direct but remains a development dependency.
  const acceptedDirect =
    knownAdvisories &&
    !expired &&
    name === "eslint-config-next" &&
    finding.severity === "high";
  if (temporarilyAccepted || acceptedDirect) {
    known++;
    continue;
  }
  console.error(`Unaccepted dependency finding: ${name} (${finding.severity})`);
  rejected = true;
}
const production = spawnSync(
  "npm",
  ["audit", "--omit=dev", "--audit-level=high"],
  { encoding: "utf8" },
);
if (production.status !== 0) {
  console.error("Production dependency audit failed.");
  rejected = true;
}
console.info(
  `Temporary development findings: ${known}; acceptance expires after 2026-11-04.`,
);
if (rejected) process.exitCode = 1;
