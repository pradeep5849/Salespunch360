import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { describe, it, expect, afterAll, vi } from "vitest";
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
const prefix = `Logo ${randomUUID()}`;
const storage = vi.hoisted(() => ({ put: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => db[key as keyof PrismaClient] }),
}));
vi.mock("@/lib/storage", () => ({ privateStorage: () => storage }));
vi.mock("./crypto", () => ({
  hashPassword: vi.fn().mockResolvedValue("fixture-password-hash"),
}));
import { registerCompany } from "./registration";
function input() {
  return {
    productEdition: "SALESPUNCH360_ACCOUNT" as const,
    companyName: prefix,
    adminName: "Logo admin",
    adminEmail: `${randomUUID()}@example.test`,
    adminPassword: "StrongFixture-123!",
    confirmPassword: "StrongFixture-123!",
  };
}
describe.skipIf(!url)("optional registration logo atomicity", () => {
  afterAll(async () => {
    for (const c of await db.company.findMany({
      where: { name: prefix },
      select: { id: true },
    })) {
      const companyId = c.id;
      await db.accountSettings.deleteMany({ where: { companyId } });
      await db.ledgerAccount.deleteMany({ where: { companyId } });
      await db.user.deleteMany({ where: { companyId } });
      await db.branch.deleteMany({ where: { companyId } });
      await db.company.delete({ where: { id: companyId } });
    }
    await db.$disconnect();
  });
  it("stores the normalized logo and creates the complete account company together", async () => {
    storage.put.mockResolvedValue(undefined);
    const created = await registerCompany(
      input(),
      Buffer.from("processed-webp"),
    );
    expect(
      (
        await db.company.findUniqueOrThrow({
          where: { id: created.company.id },
        })
      ).logoObjectKey,
    ).toBe(`Logo/${created.company.id}.webp`);
    expect(
      await db.branch.count({ where: { companyId: created.company.id } }),
    ).toBe(1);
    expect(storage.put).toHaveBeenCalledWith(
      `Logo/${created.company.id}.webp`,
      Buffer.from("processed-webp"),
    );
  });
  it("rolls back company user and defaults when image storage fails", async () => {
    const request = input();
    storage.put.mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(
      registerCompany(request, Buffer.from("processed-webp")),
    ).rejects.toThrow("Storage unavailable");
    expect(await db.user.count({ where: { email: request.adminEmail } })).toBe(
      0,
    );
    expect(storage.delete).toHaveBeenCalled();
  });
  it("removes an uploaded object when the final logo database update fails", async () => {
    const name = `registration_logo_failure_${randomUUID().replaceAll("-", "")}`;
    await db.$executeRawUnsafe(
      `CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name='${prefix}' AND NEW."logoObjectKey" IS NOT NULL THEN RAISE EXCEPTION 'fixture logo failure'; END IF; RETURN NEW; END $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER ${name} BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION ${name}()`,
    );
    const request = input();
    storage.put.mockResolvedValue(undefined);
    storage.delete.mockClear();
    try {
      await expect(
        registerCompany(request, Buffer.from("processed-webp")),
      ).rejects.toThrow();
      expect(
        await db.user.count({ where: { email: request.adminEmail } }),
      ).toBe(0);
      expect(storage.delete).toHaveBeenCalledOnce();
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER ${name} ON companies`);
      await db.$executeRawUnsafe(`DROP FUNCTION ${name}()`);
    }
  });
});
