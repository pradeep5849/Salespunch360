import { describe, it, expect, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { probeDataApi } from "./data-api-probe.mjs";
const url = "https://mranivjvxysycpqpvrss.supabase.co";
describe("safe zero-row production Data API probe", () => {
  it("requests zero records and returns no identities, keys or raw response body", async () => {
    const f = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "must-not-be-logged" }],
    });
    const r = await probeDataApi({ url, key: "private-fixture", fetcher: f });
    expect(f.mock.calls[0][0].searchParams.get("limit")).toBe("0");
    expect(r.classification).toBe("ANON_USERS_SELECT_EXPOSED");
    expect(JSON.stringify(r)).not.toContain("must-not-be-logged");
    expect(JSON.stringify(r)).not.toContain("private-fixture");
    expect(f.mock.calls[0][1].method).toBe("GET");
  });
  it.each([
    { status: 403, code: "42501", classification: "ANON_SELECT_DENIED" },
    {
      status: 406,
      code: "PGRST106",
      classification: "REQUESTED_SCHEMA_NOT_EXPOSED",
    },
    { status: 401, code: "PGRST301", classification: "INCONCLUSIVE" },
  ])(
    "distinguishes permission/schema denial from authentication failure $code",
    async (d) => {
      const r = await probeDataApi({
        url,
        key: "fixture",
        fetcher: async () => ({
          ok: false,
          status: d.status,
          json: async () => ({ code: d.code, message: "sensitive response" }),
        }),
      });
      expect(r.classification).toBe(d.classification);
      expect(JSON.stringify(r)).not.toContain("sensitive");
    },
  );
  it("refuses another database or missing key before any request", async () => {
    const f = vi.fn();
    await expect(
      probeDataApi({
        url: "https://other.supabase.co",
        key: "fixture",
        fetcher: f,
      }),
    ).rejects.toThrow("EXPECTED_PROJECT");
    await expect(probeDataApi({ url, fetcher: f })).rejects.toThrow(
      "KEY_BINDING",
    );
    expect(f).not.toHaveBeenCalled();
  });
});

it("read-only preflight never prints a malformed connection secret", () => {
  const sentinel = "private-fixture-sentinel";
  const child = spawnSync(
    process.execPath,
    ["scripts/production-readiness/preflight.mjs"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DIRECT_URL: `postgresql://fixture:${sentinel}@[`,
        DATABASE_URL: "",
      },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  expect(child.status).not.toBe(0);
  expect(child.stderr + child.stdout).not.toContain(sentinel);
  expect(child.stderr).toContain("sensitive details suppressed");
});
