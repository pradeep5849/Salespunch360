import { describe, expect, it, vi } from "vitest";
import {
  checkProductionHealth,
  HEALTH_URL,
  runHealthMonitor,
} from "./check-production-health.mjs";

describe("production readiness monitor", () => {
  it("requires a ready application and reachable database", async () => {
    const fetchHealth = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ status: "ready", database: "reachable" }),
          { status: 200 },
        ),
      );
    await expect(checkProductionHealth(fetchHealth)).resolves.toBe(true);
    expect(fetchHealth).toHaveBeenCalledWith(
      HEALTH_URL,
      expect.objectContaining({
        redirect: "error",
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it.each([503, 401, 302, 404])("rejects HTTP %s", async (status) => {
    await expect(
      checkProductionHealth(
        vi.fn().mockResolvedValue(new Response("", { status })),
      ),
    ).rejects.toThrow("unavailable");
  });
  it.each([
    { status: "ready", database: "unreachable" },
    { status: "not-ready", database: "reachable" },
    {},
  ])("rejects a misleading 200 response %j", async (body) => {
    await expect(
      checkProductionHealth(
        vi.fn().mockResolvedValue(new Response(JSON.stringify(body))),
      ),
    ).rejects.toThrow("readiness failed");
  });
  it("recovers from a transient failure", async () => {
    const check = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(true);
    const pause = vi.fn().mockResolvedValue(undefined);
    await expect(runHealthMonitor(check, pause)).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledWith(2000);
  });
  it("fails after three attempts without exposing the underlying error", async () => {
    const check = vi.fn().mockRejectedValue(new Error("sensitive response"));
    await expect(
      runHealthMonitor(check, vi.fn().mockResolvedValue(undefined)),
    ).rejects.toThrow("Production health failed three checks.");
    expect(check).toHaveBeenCalledTimes(3);
  });
});
