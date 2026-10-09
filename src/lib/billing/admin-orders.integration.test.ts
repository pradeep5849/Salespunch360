import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
const url = process.env.ACCOUNT_INTEGRATION_DATABASE_URL;
if (url && !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("Isolated local database required");
const db = new PrismaClient({
  datasources: {
    db: {
      url: url ?? "postgresql://test:test@127.0.0.1:55432/salespunch360_test",
    },
  },
});
const companyId = randomUUID(),
  userId = randomUUID(),
  prefix = `Order fixture ${randomUUID()}`;
const permit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/authorization", () => ({
  requireGlobalSuperAdmin: permit,
  requireGlobalSuperAdminForMutation: permit,
}));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => db[key as keyof PrismaClient] }),
}));
import { platformOrdersPage } from "./service";
import { telecallerOrdersPage } from "./telecaller";
describe.skipIf(!url)(
  "admin pending and history isolation from legacy caps",
  () => {
    beforeAll(async () => {
      permit.mockResolvedValue({ id: "global-admin" });
      await db.company.create({
        data: { id: companyId, name: prefix, slug: companyId },
      });
      await db.user.create({
        data: {
          id: userId,
          companyId,
          name: "Test admin",
          email: `${userId}@example.test`,
          passwordHash: "fixture",
          role: "COMPANY_ADMIN",
        },
      });
      await db.billingOrder.createMany({
        data: Array.from({ length: 502 }, (_, i) => ({
          companyId,
          createdByUserId: userId,
          billingPeriod: "YEARLY" as const,
          managerSeats: 0,
          salesSeats: 1,
          managerUnitPrice: "0",
          salesUnitPrice: "999.50",
          currency: "INR",
          subtotal: "999.50",
          totalAmount: "999.50",
          status: i === 501 ? ("PENDING" as const) : ("CANCELLED" as const),
          idempotencyKey: randomUUID(),
          createdAt: new Date(Date.now() - i * 1000),
        })),
      });
      await db.$executeRaw(
        Prisma.sql`INSERT INTO telecaller_billing_orders (id,"companyId","createdByUserId","billingPeriod","addedSeats","targetSeats","unitPrice",subtotal,"totalAmount",status,"coTermStartsAt","coTermEndsAt","createdAt","updatedAt") SELECT gen_random_uuid(),${companyId}::uuid,${userId}::uuid,'YEARLY',1,1,999.50,999.50,999.50,CASE WHEN i=301 THEN 'PENDING' ELSE 'CANCELLED' END,NOW(),NOW()+interval '1 year',NOW()-i*interval '1 second',NOW() FROM generate_series(0,301) i`,
      );
    });
    afterAll(async () => {
      await db.$executeRaw`DELETE FROM telecaller_billing_orders WHERE "companyId"=${companyId}::uuid`;
      await db.paymentTransaction.deleteMany({ where: { companyId } });
      await db.billingOrder.deleteMany({ where: { companyId } });
      await db.user.deleteMany({ where: { companyId } });
      await db.company.deleteMany({ where: { id: companyId } });
      await db.$disconnect();
    });
    it("finds an older pending normal/legacy order beyond 500/300 newer closed records", async () => {
      const normal = await platformOrdersPage({ q: prefix, pending: true }),
        legacy = await telecallerOrdersPage({ q: prefix, pending: true });
      expect(normal.items).toHaveLength(1);
      expect(legacy.items).toHaveLength(1);
      expect(normal.items[0].status).toBe("PENDING");
      expect(legacy.items[0].status).toBe("PENDING");
      expect(normal.items[0].totalAmount.toFixed(2)).toBe("999.50");
    });
    it("pages closed history deterministically and allows older records to be reached", async () => {
      const ids = new Set<string>();
      for (let page = 1; page <= 11; page++) {
        const r = await platformOrdersPage({ q: prefix, page });
        r.items.forEach((x) => ids.add(x.id));
        expect(r.items.length).toBeLessThanOrEqual(50);
      }
      expect(ids.size).toBe(501);
      const last = await telecallerOrdersPage({ q: prefix, page: 7 });
      expect(last.items).toHaveLength(1);
      expect(last.hasMore).toBe(false);
    });
    it("enforces the deployed manual reference constraint without deleting financial records", async () => {
      const order = await db.billingOrder.findFirstOrThrow({
        where: { companyId },
      });
      const reference = randomUUID().toUpperCase();
      const input = {
        companyId,
        orderId: order.id,
        provider: "MANUAL",
        providerPaymentId: randomUUID(),
        manualReference: reference,
        amount: "999.50",
        currency: "INR",
        status: "CAPTURED" as const,
      };
      await db.paymentTransaction.create({ data: input });
      await expect(
        db.paymentTransaction.create({
          data: { ...input, providerPaymentId: randomUUID() },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      expect(
        await db.paymentTransaction.count({
          where: { companyId, manualReference: reference },
        }),
      ).toBe(1);
    });
    it("rejects unauthorized reads before database access", async () => {
      permit.mockRejectedValueOnce(new Error("Denied"));
      await expect(platformOrdersPage({})).rejects.toThrow("Denied");
      permit.mockRejectedValueOnce(new Error("Denied"));
      await expect(telecallerOrdersPage({})).rejects.toThrow("Denied");
    });
  },
);
