import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
const slot = vi.hoisted(() => ({
  client: null as unknown as import("@prisma/client").PrismaClient,
}));
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_target, key) => {
        const value = slot.client[key as keyof typeof slot.client];
        return typeof value === "function" ? value.bind(slot.client) : value;
      },
    },
  ),
}));
vi.mock("@/lib/auth/authorization", () => ({ requirePermission: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
import {
  claimCheckout,
  claimPurchase,
  claimRegistration,
  confirmedOrderForActor,
  receiptKey,
} from "./server";
const fixtureUrl = process.env.ANALYTICS_INTEGRATION_DATABASE_URL;
const enabled = !!fixtureUrl;
const companyId = randomUUID(),
  userId = randomUUID(),
  orderId = randomUUID(),
  paymentId = randomUUID(),
  subscriptionId = randomUUID(),
  checkoutId = randomUUID();
const actor = { id: userId, companyId };

describe.skipIf(!enabled)("real PostgreSQL conversion receipts", () => {
  beforeAll(async () => {
    const parsed = new URL(fixtureUrl!);
    if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/analytics_ci")
      throw new Error("ISOLATED_ANALYTICS_FIXTURE_REQUIRED");
    slot.client = new PrismaClient({
      datasources: { db: { url: fixtureUrl } },
    });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "https://www.salespunch360.com");
    vi.stubEnv("ANALYTICS_ENABLED", "true");
    vi.stubEnv("CASHFREE_ENV", "production");
    vi.stubEnv("ANALYTICS_INTERNAL_COMPANY_IDS", "");
    const capturedAt = new Date(Date.now() - 1000);
    await slot.client.company.create({
      data: {
        id: companyId,
        name: "Synthetic analytics fixture",
        slug: "analytics-" + companyId,
        productEdition: "SALESPUNCH360",
      },
    });
    await slot.client.user.create({
      data: {
        id: userId,
        companyId,
        name: "Synthetic owner",
        email: userId + "@example.invalid",
        passwordHash: "synthetic-only",
        role: "COMPANY_ADMIN",
        salesRole: "PRIMARY_ADMIN",
        salesAccessActive: true,
      },
    });
    const base = {
      companyId,
      createdByUserId: userId,
      billingPeriod: "YEARLY" as const,
      managerSeats: 1,
      salesSeats: 1,
      managerUnitPrice: "49.75",
      salesUnitPrice: "50.00",
      currency: "INR",
      subtotal: "99.75",
      totalAmount: "99.75",
      createdAt: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() + 3600000),
    };
    await slot.client.billingOrder.create({
      data: {
        ...base,
        id: orderId,
        status: "PAID",
        paidAt: capturedAt,
        idempotencyKey: "analytics-" + orderId,
      },
    });
    await slot.client.billingOrder.create({
      data: {
        ...base,
        id: checkoutId,
        status: "PENDING",
        idempotencyKey: "analytics-" + checkoutId,
      },
    });
    await slot.client.paymentTransaction.create({
      data: {
        id: paymentId,
        companyId,
        orderId,
        provider: "CASHFREE",
        providerPaymentId: "live_" + randomUUID().replaceAll("-", ""),
        amount: "99.75",
        currency: "INR",
        status: "CAPTURED",
        capturedAt,
      },
    });
    await slot.client.companySubscription.create({
      data: {
        id: subscriptionId,
        companyId,
        sourceOrderId: orderId,
        status: "ACTIVE",
        billingPeriod: "YEARLY",
        managerSeats: 1,
        salesSeats: 1,
        startsAt: capturedAt,
        endsAt: new Date(Date.now() + 365 * 86400000),
      },
    });
    await slot.client.billingAuditEvent.create({
      data: {
        companyId,
        entityId: paymentId,
        type: "PAYMENT_CAPTURED",
        metadata: {
          orderId,
          subscriptionId,
          providerEnvironment: "production",
        },
      },
    });
    await slot.client.analyticsEventReceipt.createMany({
      data: [
        { keyHash: receiptKey("sign_up", userId), eventName: "sign_up" },
        {
          keyHash: receiptKey(`begin_checkout:${userId}`, checkoutId),
          eventName: "begin_checkout",
          context: "cashfree:production",
        },
      ],
    });
  });
  afterAll(async () => {
    if (slot.client) await slot.client.$disconnect();
  });
  it("confirms the same tenant's capture plus persisted subscription activation", async () => {
    expect(await confirmedOrderForActor(actor, orderId)).toMatchObject({
      evidence: { activated: true, amount: "99.75", paymentAmount: "99.75" },
    });
    expect(
      await confirmedOrderForActor({ companyId: randomUUID() }, orderId),
    ).toBeNull();
    expect(await confirmedOrderForActor(actor, checkoutId)).toBeNull();
  });
  it("admits exactly one of ten concurrent purchase claims and rejects later callbacks", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => claimPurchase(actor, orderId)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)).toMatchObject({
      transaction_id: orderId,
      value: 99.75,
      currency: "INR",
    });
    expect(await claimPurchase(actor, orderId)).toBeNull();
  });
  it("claims a genuine signup and checkout only once across concurrent consumers", async () => {
    const registrations = await Promise.all(
      Array.from({ length: 8 }, () => claimRegistration(userId)),
    );
    expect(registrations.filter(Boolean)).toHaveLength(1);
    const checkouts = await Promise.all(
      Array.from({ length: 8 }, () => claimCheckout(actor, checkoutId)),
    );
    expect(checkouts.filter(Boolean)).toHaveLength(1);
    expect(await claimRegistration(randomUUID())).toBeNull();
  });
  it("keeps private receipt rows inaccessible to a non-owner client role even with SELECT granted", async () => {
    await slot.client.$executeRawUnsafe(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='analytics_rls_fixture') THEN CREATE ROLE analytics_rls_fixture NOLOGIN; END IF; END $$",
    );
    await slot.client.$executeRawUnsafe(
      "GRANT USAGE ON SCHEMA public TO analytics_rls_fixture",
    );
    await slot.client.$executeRawUnsafe(
      "GRANT SELECT ON analytics_event_receipts TO analytics_rls_fixture",
    );
    expect(await slot.client.analyticsEventReceipt.count()).toBeGreaterThan(0);
    const visible = await slot.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE analytics_rls_fixture");
      return tx.$queryRawUnsafe<Array<{ count: bigint }>>(
        "SELECT count(*) FROM analytics_event_receipts",
      );
    });
    expect(Number(visible[0].count)).toBe(0);
  });
});
