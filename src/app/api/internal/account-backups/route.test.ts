import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ authorized: vi.fn(), generate: vi.fn() }));
vi.mock("@/lib/field-jobs/service", () => ({
  authorizedJobRunner: m.authorized,
}));
vi.mock("@/lib/account/backup-settings", () => ({
  generateScheduledAccountBackups: m.generate,
}));
import { POST } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
});
it("does not run backups for an unauthorized job caller", async () => {
  m.authorized.mockReturnValue(false);
  const response = await POST(
    new Request("https://www.salespunch360.com/api/internal/account-backups", {
      method: "POST",
    }),
  );
  expect(response.status).toBe(401);
  expect(m.generate).not.toHaveBeenCalled();
});
it("returns only delivery counters for the authenticated maintenance runner", async () => {
  m.authorized.mockReturnValue(true);
  m.generate.mockResolvedValue({
    companies: 1,
    generated: 1,
    requiresGoogleDriveSetup: 0,
    failed: 0,
  });
  const response = await POST(
    new Request("https://www.salespunch360.com/api/internal/account-backups", {
      method: "POST",
      headers: { authorization: "Bearer runner-fixture" },
    }),
  );
  expect(m.authorized).toHaveBeenCalledWith("Bearer runner-fixture");
  expect(await response.json()).toEqual({
    companies: 1,
    generated: 1,
    requiresGoogleDriveSetup: 0,
    failed: 0,
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
