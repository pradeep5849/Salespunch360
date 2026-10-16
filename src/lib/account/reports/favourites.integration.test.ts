import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import {
  availableReportCatalogueForActor,
  reportFavouritesForActor,
  setReportFavouriteForActor,
} from "./favourites";
const companyId = randomUUID(),
  otherCompany = randomUUID(),
  a = randomUUID(),
  b = randomUUID(),
  foreign = randomUUID();
beforeAll(async () => {
  if (!url) return;
  for (const id of [companyId, otherCompany])
    await client.company.create({
      data: {
        id,
        name: "Report favourite test",
        slug: `report-favourites-${id}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
      },
    });
  for (const [id, tenant] of [
    [a, companyId],
    [b, companyId],
    [foreign, otherCompany],
  ])
    await client.user.create({
      data: {
        id,
        companyId: tenant,
        name: "Report user",
        email: `${id}@example.test`,
        passwordHash: "not-login-test",
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
      },
    });
});
afterAll(async () => {
  if (!url) return;
  await client.accountSettings.deleteMany({
    where: { companyId: { in: [companyId, otherCompany] } },
  });
  await client.user.deleteMany({
    where: { companyId: { in: [companyId, otherCompany] } },
  });
  await client.company.deleteMany({
    where: { id: { in: [companyId, otherCompany] } },
  });
  await client.$disconnect();
});
it.skipIf(!url)(
  "stores one favourite under concurrent retries and isolates users/companies",
  async () => {
    const actor = { id: a, companyId };
    await Promise.all(
      Array.from({ length: 6 }, () =>
        setReportFavouriteForActor(actor, {
          reportKey: "profit-loss",
          favourite: true,
        }),
      ),
    );
    expect(await reportFavouritesForActor(actor)).toEqual(["profit-loss"]);
    expect(
      await client.accountReportFavourite.count({
        where: { companyId, userId: a },
      }),
    ).toBe(1);
    expect(await reportFavouritesForActor({ id: b, companyId })).toEqual([]);
    expect(
      await reportFavouritesForActor({ id: foreign, companyId: otherCompany }),
    ).toEqual([]);
    await expect(
      setReportFavouriteForActor(
        { id: foreign, companyId },
        { reportKey: "profit-loss", favourite: true },
      ),
    ).rejects.toThrow();
    await expect(
      client.accountReportFavourite.create({
        data: { companyId, userId: foreign, reportKey: "tax" },
      }),
    ).rejects.toThrow();
    await setReportFavouriteForActor(actor, {
      reportKey: "profit-loss",
      favourite: false,
    });
    await setReportFavouriteForActor(actor, {
      reportKey: "profit-loss",
      favourite: false,
    });
    expect(await reportFavouritesForActor(actor)).toEqual([]);
  },
);
it.skipIf(!url)(
  "denies report permissions,unknown destinations and injected tenant fields",
  async () => {
    const actor = { id: b, companyId };
    await expect(
      setReportFavouriteForActor(actor, {
        reportKey: "../../settings",
        favourite: true,
      }),
    ).rejects.toThrow();
    await expect(
      setReportFavouriteForActor(actor, {
        reportKey: "tax",
        favourite: true,
        companyId: otherCompany,
      }),
    ).rejects.toThrow();
    await client.user.update({
      where: { id: b },
      data: { accountRole: "DATA_ENTRY" },
    });
    await expect(reportFavouritesForActor(actor)).rejects.toThrow();
    await expect(
      setReportFavouriteForActor(actor, { reportKey: "tax", favourite: true }),
    ).rejects.toThrow();
  },
);
it.skipIf(!url)(
  "limits Project Managers and hides disabled optional reports without deleting preferences",
  async () => {
    const actor = { id: a, companyId };
    await setReportFavouriteForActor(actor, {
      reportKey: "projects",
      favourite: true,
    });
    await client.user.update({
      where: { id: a },
      data: { accountRole: "PROJECT_MANAGER" },
    });
    expect(
      (await availableReportCatalogueForActor(actor)).map((x) => x.key),
    ).toEqual(["projects"]);
    await expect(
      setReportFavouriteForActor(actor, {
        reportKey: "profit-loss",
        favourite: true,
      }),
    ).rejects.toThrow();
    await client.accountSettings.create({
      data: { companyId, enabledModules: [] },
    });
    expect(await availableReportCatalogueForActor(actor)).toEqual([]);
    expect(await reportFavouritesForActor(actor)).toEqual([]);
    expect(
      await client.accountReportFavourite.count({
        where: { companyId, userId: a, reportKey: "projects" },
      }),
    ).toBe(1);
    await client.accountSettings.delete({ where: { companyId } });
  },
);
