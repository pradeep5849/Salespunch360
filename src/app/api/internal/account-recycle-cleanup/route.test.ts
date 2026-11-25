import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ authorized: vi.fn(), purge: vi.fn(), storage: vi.fn() }));
vi.mock("@/lib/field-jobs/service", () => ({
  authorizedJobRunner: m.authorized,
}));
vi.mock("@/lib/account/recycle-retention", () => ({
  purgeExpiredRecycleRecords: m.purge,
}));
vi.mock("@/lib/storage/deletion-queue", () => ({ retryPendingStorageDeletions: m.storage }));
import { POST } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  m.storage.mockResolvedValue({ processed: 0, deleted: 0, failed: 0 });
  m.purge.mockResolvedValue({ processed: 0, active: false });
});
it("does not run deletion for an unauthenticated caller", async () => {
  m.authorized.mockReturnValue(false);
  expect(
    (await POST(new Request("https://example.test", { method: "POST" })))
      .status,
  ).toBe(401);
  expect(m.purge).not.toHaveBeenCalled();
  expect(m.storage).not.toHaveBeenCalled();
});
it("uses the server retention policy without accepting caller dates or IDs", async () => {
  m.authorized.mockReturnValue(true);
  const response = await POST(
    new Request("https://example.test", {
      method: "POST",
      headers: { authorization: "Bearer fixture" },
      body: JSON.stringify({ now: "2099-01-01", limit: 100000 }),
    }),
  );
  expect(response.status).toBe(200);
  expect(m.purge).toHaveBeenCalledWith();
  expect(m.storage).toHaveBeenCalledWith();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

it("reports partial cleanup failure as retryable without hiding completed counts", async () => {
  m.authorized.mockReturnValue(true);
  const report = {
    processed: 3,
    purged: 1,
    retained: 1,
    skipped: 0,
    failed: 1,
    active: true,
  };
  m.purge.mockResolvedValue(report);
  const response = await POST(
    new Request("https://example.test", { method: "POST" }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ...report, storage: { processed: 0, deleted: 0, failed: 0 } });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
it("keeps protected history retention a successful bounded result", async () => {
  m.authorized.mockReturnValue(true);
  m.purge.mockResolvedValue({
    processed: 2,
    purged: 0,
    retained: 2,
    skipped: 0,
    failed: 0,
    active: true,
  });
  expect(
    (await POST(new Request("https://example.test", { method: "POST" })))
      .status,
  ).toBe(200);
});

it("reports failed physical deletion as retryable", async () => {
  m.authorized.mockReturnValue(true);
  m.storage.mockResolvedValue({ processed: 2, deleted: 1, failed: 1 });
  const response = await POST(new Request("https://example.test", { method: "POST" }));
  expect(response.status).toBe(503);
  expect((await response.json()).storage).toEqual({ processed: 2, deleted: 1, failed: 1 });
});
