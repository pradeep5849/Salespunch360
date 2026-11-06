import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const url = process.env.RESTORE_TEST_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/numbering_ci" },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
vi.mock("@/lib/billing/entitlement", () => ({
  assertOperationalWrite: vi.fn(),
}));
import {
  previewNumberingRestart,
  confirmNumberingRestart,
} from "./numbering-restart";
import { allocateDocumentNumberInTx } from "./numbering";
const companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  seriesId = randomUUID();
const actor = { id: userId, companyId, accountRole: "ACCOUNT_ADMIN" };
const input = (prefix: string) => ({
  seriesId,
  prefix,
  reason: "New financial-year numbering",
});
describe.skipIf(!url)("reviewed history-preserving numbering restart", () => {
  beforeAll(async () => {
    await client.company.create({
      data: {
        id: companyId,
        name: "Numbering fixture",
        slug: `numbering-${companyId}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
      },
    });
    await client.user.create({
      data: {
        id: userId,
        companyId,
        name: "Fixture",
        email: `${userId}@example.test`,
        passwordHash: "fixture-only",
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
        branchAccessScope: "ALL_BRANCHES",
      },
    });
    await client.branch.create({
      data: { id: branchId, companyId, name: "Main", code: "MAIN" },
    });
    await client.numberingSeries.create({
      data: {
        id: seriesId,
        companyId,
        branchId,
        seriesKey: "SALES_INVOICE",
        prefix: "OLD/",
        padding: 4,
        nextSequence: BigInt(51),
      },
    });
  });
  afterAll(async () => {
    await client.$disconnect();
  });
  it("preview is read-only, rejects token tampering and requires explicit confirmation", async () => {
    const review = await previewNumberingRestart(actor, input("NEW/"));
    expect(review.examples).toEqual(["NEW/0001", "NEW/0002", "NEW/0003"]);
    expect(
      (
        await client.numberingSeries.findUniqueOrThrow({
          where: { id: seriesId },
        })
      ).nextSequence,
    ).toBe(BigInt(51));
    await expect(
      confirmNumberingRestart(actor, {
        token: review.token + "x",
        confirmed: true,
      }),
    ).rejects.toThrow("NUMBERING_INVALID_REVIEW");
    await expect(
      confirmNumberingRestart(actor, { token: review.token, confirmed: false }),
    ).rejects.toThrow();
    expect(
      await client.accountingAuditEvent.count({ where: { companyId } }),
    ).toBe(0);
  });
  it("rejects a stale preview after a real number is allocated", async () => {
    const review = await previewNumberingRestart(actor, input("NEXT/"));
    expect(
      await client.$transaction((tx) =>
        allocateDocumentNumberInTx(tx, { companyId, branchId, seriesId }),
      ),
    ).toBe("OLD/0051");
    await expect(
      confirmNumberingRestart(actor, { token: review.token, confirmed: true }),
    ).rejects.toThrow("NUMBERING_PREVIEW_STALE");
    expect(
      (
        await client.numberingSeries.findUniqueOrThrow({
          where: { id: seriesId },
        })
      ).prefix,
    ).toBe("OLD/");
  });
  it("serializes concurrent confirmations, audits once and allocates from one", async () => {
    const review = await previewNumberingRestart(actor, input("FY27/"));
    const [a, b] = await Promise.all([
      confirmNumberingRestart(actor, { token: review.token, confirmed: true }),
      confirmNumberingRestart(actor, { token: review.token, confirmed: true }),
    ]);
    expect(a.auditId).toBe(b.auditId);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    expect(
      await client.accountingAuditEvent.count({
        where: { companyId, entityType: "NUMBERING_SERIES" },
      }),
    ).toBe(1);
    expect(
      await client.$transaction((tx) =>
        allocateDocumentNumberInTx(tx, { companyId, branchId, seriesId }),
      ),
    ).toBe("FY27/0001");
    await expect(
      previewNumberingRestart(actor, input("FY27/")),
    ).rejects.toThrow("NUMBERING_PREFIX_ALREADY_USED");
  });
  it("rechecks current branch scope and actor binding on confirmation", async () => {
    const review = await previewNumberingRestart(actor, input("AFTER/"));
    await expect(
      confirmNumberingRestart(
        { ...actor, id: randomUUID() },
        { token: review.token, confirmed: true },
      ),
    ).rejects.toThrow("Not authorized");
    await client.user.update({
      where: { id: userId },
      data: { branchAccessScope: "SELECTED_BRANCHES" },
    });
    await expect(
      confirmNumberingRestart(actor, { token: review.token, confirmed: true }),
    ).rejects.toThrow("Not authorized");
    expect(
      (
        await client.numberingSeries.findUniqueOrThrow({
          where: { id: seriesId },
        })
      ).prefix,
    ).toBe("FY27/");
  });
});
