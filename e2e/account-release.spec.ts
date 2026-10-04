import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test } from "@playwright/test";
const db = new PrismaClient();
const password = "Release-smoke-only-934!";
let email: string;
const companyIds: string[] = [],
  branchIds: string[] = [],
  userIds: string[] = [];
test.beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.pathname.endsWith("_ci")
  )
    throw new Error(
      "Browser fixtures require an isolated local *_ci database.",
    );
  const passwordHash = await hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  for (let i = 0; i < 2; i++) {
    const nonce = randomUUID();
    const company = await db.company.create({
      data: {
        name: `Release smoke ${nonce}`,
        slug: `release-${nonce}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
        enabledModules: ["ACCOUNTING", "INVENTORY", "PROJECTS"],
        subscriptionStatus: "ACTIVE",
      },
    });
    companyIds.push(company.id);
    const branch = await db.branch.create({
      data: {
        companyId: company.id,
        name: `Private branch ${nonce}`,
        code: "PRIMARY",
        isPrimary: true,
      },
    });
    branchIds.push(branch.id);
    const user = await db.user.create({
      data: {
        companyId: company.id,
        name: "Release smoke",
        email: `${nonce}@example.test`,
        passwordHash,
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    userIds.push(user.id);
    if (i === 0) email = user.email;
  }
});
test.afterAll(async () => {
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.mobileSession.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.branch.deleteMany({ where: { id: { in: branchIds } } });
  await db.company.deleteMany({ where: { id: { in: companyIds } } });
  await db.$disconnect();
});
test("real login opens Account and a revoked session returns to sign-in", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/account/);
  await expect(
    page.getByRole("tab", { name: "Transaction Details", exact: true }),
  ).toBeVisible();
  await db.user.update({
    where: { id: userIds[0] },
    data: { sessionVersion: { increment: 1 } },
  });
  await page.goto("/workspace/account");
  await expect(page).toHaveURL(/\/sign-in/);
});
test("authenticated mobile Account request rejects another tenant branch", async ({
  request,
}) => {
  const login = await request.post("/api/v1/mobile/auth/login", {
    data: {
      identifier: email,
      password,
      deviceId: randomUUID(),
      deviceName: "CI release smoke",
    },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json();
  expect(typeof accessToken).toBe("string");
  const headers = { authorization: `Bearer ${accessToken}` };
  const own = await request.get(
    `/api/v1/mobile/account/dashboard?branchId=${branchIds[0]}`,
    { headers },
  );
  expect(own.status()).toBe(200);
  const foreign = await request.get(
    `/api/v1/mobile/account/dashboard?branchId=${branchIds[1]}`,
    { headers },
  );
  expect(foreign.status()).toBe(403);
  expect(await foreign.json()).toEqual({ error: "FORBIDDEN" });
});
