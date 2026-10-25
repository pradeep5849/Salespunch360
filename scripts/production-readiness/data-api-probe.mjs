import { pathToFileURL } from "node:url";
/** Probe SELECT permission with limit=0. Never fetch/log user rows, API keys, tokens or raw error messages. */
export async function probeDataApi({ url, key, fetcher = fetch }) {
  const target = new URL(url);
  if (target.origin !== "https://mranivjvxysycpqpvrss.supabase.co")
    throw new Error("EXPECTED_PROJECT_HTTPS_REQUIRED");
  if (!key) throw new Error("SECURE_PUBLISHABLE_KEY_BINDING_REQUIRED");
  const headers = { apikey: key, Accept: "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  const response = await fetcher(
    new URL("/rest/v1/users?select=id&limit=0", target),
    {
      method: "GET",
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  const body = await response.json().catch(() => null);
  const code =
    typeof body?.code === "string" && /^[A-Z0-9_]+$/.test(body.code)
      ? body.code
      : undefined;
  return {
    http_status: response.status,
    database_error_code: code,
    classification:
      response.ok && Array.isArray(body)
        ? "ANON_USERS_SELECT_EXPOSED"
        : code === "42501"
          ? "ANON_SELECT_DENIED"
          : code === "PGRST106"
            ? "REQUESTED_SCHEMA_NOT_EXPOSED"
            : "INCONCLUSIVE",
    records_requested: 0,
    production_writes: false,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  probeDataApi({
    url: process.env.SUPABASE_PROJECT_URL ?? "",
    key: process.env.SUPABASE_PUBLISHABLE_KEY,
  })
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch(() => {
      console.error(
        "Data API probe unavailable; check approved HTTPS access and secure key binding. Sensitive details suppressed.",
      );
      process.exitCode = 1;
    });
}
