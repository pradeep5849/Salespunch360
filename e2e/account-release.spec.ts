import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { expect, test, type APIRequestContext } from "@playwright/test";
const db = new PrismaClient();
const password = "Release-smoke-only-934!";
let email: string;
let foreignCustomerId: string;
let foreignUnitId: string;
let inactiveUnitId: string;
let productCategoryId: string;
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
        subscriptionStatus: "TRIAL",
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 86400000 * 7),
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
    if (i === 0) {
      email = user.email;
      await db.customer.createMany({
        data: Array.from({ length: 205 }, (_, index) => ({
          companyId: company.id,
          branchId: branch.id,
          name: `A release fixture ${String(index).padStart(3, "0")}`,
          isAccountCustomer: true,
        })),
      });
      inactiveUnitId = (
        await db.accountUnit.create({
          data: {
            companyId: company.id,
            name: "Inactive unit",
            symbol: "OLD",
            isActive: false,
          },
        })
      ).id;
      productCategoryId = (
        await db.accountCategory.create({
          data: {
            companyId: company.id,
            name: "Products only",
            scope: "PRODUCT",
          },
        })
      ).id;
    } else {
      foreignCustomerId = (
        await db.customer.create({
          data: {
            companyId: company.id,
            branchId: branch.id,
            name: "Foreign private party",
            isAccountCustomer: true,
          },
        })
      ).id;
      foreignUnitId = (
        await db.accountUnit.create({
          data: {
            companyId: company.id,
            name: "Foreign unit",
            symbol: "FOREIGN",
          },
        })
      ).id;
    }
  }
});
test.afterAll(async () => {
  await db.session.deleteMany({ where: { userId: { in: userIds } } });
  await db.mobileSession.deleteMany({ where: { userId: { in: userIds } } });
  await db.accountService.deleteMany({
    where: { companyId: { in: companyIds } },
  });
  await db.customer.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.accountUnit.deleteMany({ where: { companyId: { in: companyIds } } });
  await db.accountCategory.deleteMany({
    where: { companyId: { in: companyIds } },
  });
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

async function mobileHeaders(request: APIRequestContext) {
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
  return { authorization: `Bearer ${accessToken}` };
}

test("customer mutation remains accessible beyond 200 rows and denies foreign reads and edits", async ({
  request,
}) => {
  const headers = await mobileHeaders(request);
  const path = "/api/v1/mobile/account/master-data/customers";
  const name = `ZZZ release mutation ${randomUUID()}`;
  const created = await request.post(path, {
    headers,
    data: { name, branchId: branchIds[0] },
  });
  expect(created.status()).toBe(201);
  const { record } = await created.json();
  expect(record.name).toBe(name);
  expect(record.branchId).toBe(branchIds[0]);
  const detail = await request.get(`${path}/${record.id}`, { headers });
  expect(detail.status()).toBe(200);
  expect((await detail.json()).record.id).toBe(record.id);
  const renamed = `${name} updated`;
  const updated = await request.patch(`${path}/${record.id}`, {
    headers,
    data: { name: renamed, branchId: branchIds[0] },
  });
  expect(updated.status()).toBe(200);
  expect((await updated.json()).record.name).toBe(renamed);
  expect(
    await db.customer.findUniqueOrThrow({
      where: { id: record.id },
      select: { companyId: true, name: true },
    }),
  ).toEqual({ companyId: companyIds[0], name: renamed });
  for (const method of ["get", "patch"] as const) {
    const response = await request[method](`${path}/${foreignCustomerId}`, {
      headers,
      ...(method === "patch"
        ? { data: { name: "Unauthorized edit", branchId: branchIds[0] } }
        : {}),
    });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "FORBIDDEN" });
  }
  expect(
    (await db.customer.findUniqueOrThrow({ where: { id: foreignCustomerId } }))
      .name,
  ).toBe("Foreign private party");
  const invalid = await request.post(path, {
    headers,
    data: { name: "", branchId: branchIds[0] },
  });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error).toBe("INVALID_INPUT");
});

test("service rejects foreign or inactive units and product-only categories without creating rows", async ({
  request,
}) => {
  const headers = await mobileHeaders(request);
  const before = await db.accountService.count({
    where: { companyId: companyIds[0] },
  });
  for (const reference of [
    { unitId: foreignUnitId },
    { unitId: inactiveUnitId },
    { categoryId: productCategoryId },
  ]) {
    const response = await request.post(
      "/api/v1/mobile/account/master-data/services",
      {
        headers,
        data: { name: "Rejected service", ...reference },
      },
    );
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("INVALID_INPUT");
  }
  expect(
    await db.accountService.count({ where: { companyId: companyIds[0] } }),
  ).toBe(before);
});

test("mobile logout revokes access and deactivation invalidates an issued token", async ({
  request,
}) => {
  const headers = await mobileHeaders(request);
  const path = "/api/v1/mobile/account/master-data/customers";
  expect((await request.get(path, { headers })).status()).toBe(200);
  expect(
    (await request.post("/api/v1/mobile/auth/logout", { headers })).status(),
  ).toBe(200);
  const revoked = await request.get(path, { headers });
  expect(revoked.status()).toBe(401);
  expect(await revoked.json()).toEqual({ error: "UNAUTHORIZED" });
  const freshHeaders = await mobileHeaders(request);
  try {
    await db.user.update({
      where: { id: userIds[0] },
      data: { isActive: false },
    });
    const inactive = await request.get(path, { headers: freshHeaders });
    expect(inactive.status()).toBe(401);
    expect(await inactive.json()).toEqual({ error: "UNAUTHORIZED" });
  } finally {
    await db.user.update({
      where: { id: userIds[0] },
      data: { isActive: true },
    });
  }
});
