import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const db = new PrismaClient(),
  companyId = randomUUID(),
  branchId = randomUUID(),
  userId = randomUUID(),
  password = "Asset-browser-fixture-934!",
  email = `${userId}@example.test`;
test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !url.pathname.endsWith("_ci")
  )
    throw new Error("Browser tests require isolated local *_ci database");
  await db.company.create({
    data: {
      id: companyId,
      name: "Asset browser fixture",
      slug: `asset-browser-${companyId}`,
      productEdition: "SALESPUNCH360_ACCOUNT",
      subscriptionStatus: "TRIAL",
      trialStartedAt: new Date(),
      trialEndsAt: new Date(Date.now() + 7 * 86400000),
    },
  });
  await db.accountSettings.create({
    data: { companyId, enabledModules: ["ASSETS"] },
  });
  await db.branch.create({
    data: {
      id: branchId,
      companyId,
      name: "Asset branch",
      code: "PRIMARY",
      isPrimary: true,
    },
  });
  await db.user.create({
    data: {
      id: userId,
      companyId,
      name: "Asset administrator",
      email,
      passwordHash: await hash(password),
      role: "ACCOUNT_USER",
      accountRole: "ACCOUNT_ADMIN",
      accountAccessActive: true,
      emailVerifiedAt: new Date(),
    },
  });
});
test.afterAll(async () => {
  await db.mobileSession.deleteMany({ where: { userId } });
  await db.assetAssignmentHistory.deleteMany({ where: { companyId } });
  await db.asset.deleteMany({ where: { companyId } });
  await db.accountOperationalAudit.deleteMany({ where: { companyId } });
  await db.numberingSeries.deleteMany({ where: { companyId } });
  await db.accountSettings.deleteMany({ where: { companyId } });
  await db.user.deleteMany({ where: { companyId } });
  await db.branch.deleteMany({ where: { companyId } });
  await db.company.deleteMany({ where: { id: companyId } });
  await db.$disconnect();
});
test("asset create, Save & New, edit clears, assignment, return, and lifecycle work at this viewport", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await page.goto("/workspace/account/assets/new");
  await page.getByLabel("Branch", { exact: true }).selectOption(branchId);
  await page
    .getByLabel("Asset name", { exact: true })
    .fill("Browser equipment");
  await page.getByLabel("Purchase date", { exact: true }).fill("2026-10-09");
  await page.getByLabel("Opening quantity", { exact: true }).fill("2");
  await page.getByLabel("Price per unit", { exact: true }).fill("50");
  await page
    .getByLabel("As of / effective date", { exact: true })
    .fill("2026-10-09");
  await page
    .getByLabel("HSN code (4, 6, or 8 digits)", { exact: true })
    .fill("8471");
  await page.getByLabel("Serial number", { exact: true }).fill("CLEAR-ME");
  await expect(
    page.getByLabel("Effective purchase value", { exact: true }),
  ).toHaveValue("100.00");
  await expect(
    page.getByLabel("Depreciation expense ledger", { exact: true }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include("form.stack")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Save & New", exact: true }).click();
  await expect(page).toHaveURL(/\/assets\/new\?saved=/);
  await expect(page.getByLabel("Asset name", { exact: true })).toHaveValue("");
  const asset = await db.asset.findFirstOrThrow({
    where: { companyId, name: "Browser equipment" },
  });
  expect(
    await db.asset.count({ where: { companyId, name: "Browser equipment" } }),
  ).toBe(1);
  expect(asset.purchaseValue.toFixed(2)).toBe("100.00");
  expect(asset.hsnCode).toBe("8471");
  await page.goto(`/workspace/account/assets/${asset.id}/edit`);
  await page.getByLabel("Serial number", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save asset", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/assets/${asset.id}$`));
  expect(
    (await db.asset.findUniqueOrThrow({ where: { id: asset.id } }))
      .serialNumber,
  ).toBeNull();
  await page
    .getByLabel("Assign employee", { exact: true })
    .selectOption(userId);
  await page
    .getByLabel("Assignment notes", { exact: true })
    .fill("Original assignment note");
  await page.getByRole("button", { name: "Assign asset", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Return asset", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Return notes", { exact: true })
    .fill("Returned safely");
  await page.getByRole("button", { name: "Return asset", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Return asset", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Assignment notes: Original assignment note", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Return notes: Returned safely", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Asset status", { exact: true })
    .selectOption("DISPOSED");
  await page
    .getByRole("button", { name: "Update status", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Assign asset", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await db.asset.findUniqueOrThrow({ where: { id: asset.id } })).status,
    )
    .toBe("DISPOSED");
});
test("asset pagination, search, and module OFF use authoritative server scope", async ({
  request,
  page,
}) => {
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "Asset browser API",
    },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json(),
    headers = { authorization: `Bearer ${accessToken}` };
  await db.asset.createMany({
    data: Array.from({ length: 205 }, (_, i) => ({
      companyId,
      branchId,
      assetNumber: `BROWSER-${i}`,
      name: `Paged asset ${String(i).padStart(3, "0")}`,
      assetType: "TOOL" as const,
      purchaseDate: new Date("2026-10-09"),
      purchaseValue: "10",
      createdById: userId,
    })),
  });
  const first = await request.get(
    "/api/v1/mobile/account/assets?paged=1&limit=100",
    { headers },
  );
  expect(first.status()).toBe(200);
  const data = await first.json();
  expect(data.items).toHaveLength(100);
  expect(data.hasMore).toBe(true);
  const last = await request.get(
    "/api/v1/mobile/account/assets?paged=1&offset=200&limit=100",
    { headers },
  );
  expect((await last.json()).items.length).toBeGreaterThanOrEqual(5);
  const search = await request.get(
    "/api/v1/mobile/account/assets?paged=1&q=Paged%20asset%20204",
    { headers },
  );
  expect((await search.json()).items).toHaveLength(1);
  const invalid = await request.get(
    "/api/v1/mobile/account/assets?status=FORGED",
    { headers },
  );
  expect(invalid.status()).toBe(400);
  await db.accountSettings.update({
    where: { companyId },
    data: { enabledModules: [] },
  });
  expect(
    (
      await request.get("/api/v1/mobile/account/assets?paged=1", { headers })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/v1/mobile/account/assets", {
        headers,
        data: {
          branchId,
          name: "Must reject",
          assetType: "TOOL",
          purchaseDate: "2026-10-09",
          purchaseValue: "10",
        },
      })
    ).status(),
  ).toBe(403);
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  const blocked = await page.goto("/workspace/account/assets/new");
  expect(blocked?.status()).toBe(404);
  await expect(
    page.getByRole("link", { name: "Assets", exact: true }),
  ).toHaveCount(0);

});
