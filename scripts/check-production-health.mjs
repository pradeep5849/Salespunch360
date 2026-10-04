import { fileURLToPath } from "node:url";

export const HEALTH_URL = "https://www.salespunch360.com/api/health";

export async function checkProductionHealth(fetchHealth = fetch) {
  const response = await fetchHealth(HEALTH_URL, {
    method: "GET",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json" },
  });
  if (response.status !== 200)
    throw new Error("Production health is unavailable.");
  const body = await response.json();
  if (body?.status !== "ready" || body?.database !== "reachable")
    throw new Error("Production database readiness failed.");
  return true;
}

export async function runHealthMonitor(
  check = checkProductionHealth,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await check();
      return true;
    } catch {
      if (attempt === 3)
        throw new Error(
          "Production health failed three checks. Inspect the hosting logs and /api/health request reference.",
        );
      await pause(2000);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runHealthMonitor().then(
    () => console.info("Production application and database are ready."),
    () => {
      console.error(
        "Production health failed three checks. Inspect hosting logs and /api/health. No response payloads or credentials are logged.",
      );
      process.exitCode = 1;
    },
  );
}
