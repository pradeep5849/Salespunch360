import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ reader: vi.fn(), events: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findFirst: mocks.reader },
    accountingAuditEvent: { findMany: mocks.events },
  },
}));
import { auditHistoryPageForActor } from "./audit-history";
const actor = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: "22222222-2222-4222-8222-222222222222",
  accountRole: "ACCOUNT_ADMIN",
};
const record = (id: string) => ({
  id,
  eventType: "SETTINGS_CHANGED",
  entityType: "DOCUMENT",
  entityId: "document",
  createdAt: new Date("2026-11-06T02:00:00Z"),
  actor: { name: "Admin" },
  metadata: {
    nested: {
      api_key: "never-return",
      authorization: "never-return",
      amount: "100",
    },
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.reader.mockResolvedValue({ id: actor.id });
  mocks.events.mockResolvedValue([]);
});
describe("company-wide audit reader and cursor contract", () => {
  it.each(["ACCOUNTANT", "PROJECT_MANAGER", "DATA_ENTRY"])(
    "denies %s before querying events",
    async (accountRole) => {
      await expect(
        auditHistoryPageForActor({ ...actor, accountRole }),
      ).rejects.toThrow("Not authorized");
      expect(mocks.events).not.toHaveBeenCalled();
    },
  );
  it("requires current all-branch active administrator authority", async () => {
    mocks.reader.mockResolvedValue(null);
    await expect(auditHistoryPageForActor(actor)).rejects.toThrow(
      "Not authorized",
    );
    expect(mocks.events).not.toHaveBeenCalled();
    expect(mocks.reader).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: actor.companyId,
          isActive: true,
          accountRole: "ACCOUNT_ADMIN",
          branchAccessScope: "ALL_BRANCHES",
        }),
      }),
    );
  });
  it("uses stable timestamp/id keyset pages without disclosing credential metadata", async () => {
    const a = "33333333-3333-4333-8333-333333333333",
      b = "44444444-4444-4444-8444-444444444444";
    mocks.events.mockResolvedValue([record(b), record(a)]);
    const first = await auditHistoryPageForActor(actor, { pageSize: 1 });
    expect(first.rows).toHaveLength(1);
    expect(first.nextCursor).toBeTruthy();
    expect(JSON.stringify(first)).not.toContain("never-return");
    expect(first.rows[0].metadata).toEqual({
      nested: {
        api_key: "[REDACTED]",
        authorization: "[REDACTED]",
        amount: "100",
      },
    });
    mocks.events.mockResolvedValue([record(a)]);
    await auditHistoryPageForActor(actor, {
      pageSize: 1,
      cursor: first.nextCursor,
    });
    expect(mocks.events).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: actor.companyId,
          AND: [
            {
              OR: [
                { createdAt: { lt: new Date("2026-11-06T02:00:00Z") } },
                { createdAt: new Date("2026-11-06T02:00:00Z"), id: { lt: b } },
              ],
            },
          ],
        }),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 2,
      }),
    );
  });
  it("uses an inclusive India-calendar end date and explicit actor/entity filters", async () => {
    await auditHistoryPageForActor(actor, {
      from: "2026-11-01",
      to: "2026-11-06",
      eventType: "SETTINGS_CHANGED",
      entityType: "DOCUMENT",
      actorId: actor.id,
    });
    const call = mocks.events.mock.calls[0][0];
    expect(call.where.createdAt).toEqual({
      gte: new Date("2026-10-31T18:30:00Z"),
      lt: new Date("2026-11-06T18:30:00Z"),
    });
    expect(call.where.actorUserId).toBe(actor.id);
    expect(call.where.entityType).toBe("DOCUMENT");
  });
  it.each([
    { cursor: "not-json" },
    { from: "2026-02-30" },
    { pageSize: 101 },
    { from: "2026-11-07", to: "2026-11-06" },
  ])("rejects invalid page/filter inputs before event reads", async (query) => {
    await expect(auditHistoryPageForActor(actor, query)).rejects.toThrow();
    expect(mocks.events).not.toHaveBeenCalled();
  });
});
