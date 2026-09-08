import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  cookie: "",
  tokenNumber: 0,
  users: new Map<string, Record<string, unknown>>(),
  web: [] as Array<Record<string, unknown>>,
  mobile: [] as Array<Record<string, unknown>>,
  push: [] as Array<{ userId: string; mobileSessionId: string }>,
  lockTail: Promise.resolve() as Promise<unknown>,
}));

const byId = (id: string) => state.users.get(id) ?? null;
const tx = {
  $queryRaw: vi.fn().mockResolvedValue([]),
  user: {
    findUnique: vi.fn(({ where }: { where: { id: string } }) => byId(where.id)),
    update: vi.fn(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const user = { ...byId(where.id) } as Record<string, unknown>;
      if (data.sessionVersion) user.sessionVersion = Number(user.sessionVersion) + 1;
      if (data.passwordHash) user.passwordHash = data.passwordHash;
      state.users.set(where.id, user);
      return "select" in data ? user : { sessionVersion: user.sessionVersion };
    }),
  },
  company: { findUnique: vi.fn().mockResolvedValue({ productEdition: "SALESPUNCH360" }) },
  pushDevice: { deleteMany: vi.fn(({ where }: { where: { userId: string } }) => { state.push = state.push.filter((row) => row.userId !== where.userId); }) },
  session: {
    deleteMany: vi.fn(({ where }: { where: { userId: string } }) => { state.web = state.web.filter((row) => row.userId !== where.userId); }),
    create: vi.fn(({ data }: { data: Record<string, unknown> }) => { state.web.push(data); }),
  },
  mobileSession: {
    deleteMany: vi.fn(({ where }: { where: { userId: string } }) => { state.mobile = state.mobile.filter((row) => row.userId !== where.userId); }),
    create: vi.fn(({ data }: { data: Record<string, unknown> }) => { state.mobile.push({ id: `m${state.mobile.length}`, ...data }); }),
  },
};

const db = {
  $transaction: vi.fn((callback: (client: typeof tx) => unknown) => {
    const result = state.lockTail.then(() => callback(tx));
    state.lockTail = result.catch(() => undefined);
    return result;
  }),
  user: { findFirst: vi.fn(({ where }: { where: { OR: Array<Record<string, string>> } }) => [...state.users.values()].find((u) => where.OR.some((term) => Object.entries(term).every(([key, value]) => u[key] === value))) ?? null) },
  session: { findUnique: vi.fn() },
  mobileSession: { findUnique: vi.fn(), updateMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_target, property) => db[property as keyof typeof db] }) }));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined, set: (_name: string, value: string) => { state.cookie = value; } }) }));
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("@/lib/auth/crypto", () => ({
  createSessionToken: () => `${String(++state.tokenNumber).padStart(43, "a")}`,
  hashSessionToken: (token: string) => `hash:${token}`,
  verifyPassword: async (hash: string, password: string) => hash === `hash-${password}`,
}));
vi.mock("@/lib/billing/entitlement", () => ({ effectiveEntitlement: vi.fn() }));

import { createSession, getAuthenticatedUser } from "./session";
import { replacePasswordAndRevoke } from "./session-generation";
import { authenticateMobileToken, createMobileSession } from "@/lib/mobile/auth";

const user = (id: string, email = `${id}@example.com`) => ({ id, name: id, email, passwordHash: "hash-password", role: "SALES", managerType: null, salesRole: "SALES", accountRole: null, salesAccessActive: true, accountAccessActive: false, companyId: "company", isActive: true, sessionVersion: 0, company: { productEdition: "SALESPUNCH360" } });

beforeEach(() => {
  vi.clearAllMocks(); state.cookie = ""; state.tokenNumber = 0; state.users = new Map([["a", user("a")], ["b", user("b")]]); state.web = []; state.mobile = []; state.push = []; state.lockTail = Promise.resolve();
});

describe("single active login rotation", () => {
  it("web login replaces web and mobile sessions and removes only that user's push devices", async () => {
    state.web.push({ userId: "a", sessionVersion: 0 }, { userId: "b", sessionVersion: 0, company: { productEdition: "SALESPUNCH360" } });
    state.mobile.push({ userId: "a" }, { userId: "b" }); state.push.push({ userId: "a", mobileSessionId: "old" }, { userId: "b", mobileSessionId: "other" });
    await createSession("a", true, "hash-password");
    expect(state.web.filter((row) => row.userId === "a")).toHaveLength(1); expect(state.web.find((row) => row.userId === "a")?.sessionVersion).toBe(1);
    expect(state.mobile).toEqual([{ userId: "b" }]); expect(state.push).toEqual([{ userId: "b", mobileSessionId: "other" }]); expect(state.web.some((row) => row.userId === "b")).toBe(true);
  });

  it("mobile login replaces mobile and web sessions and removes old push devices", async () => {
    state.web.push({ userId: "a" }); state.mobile.push({ userId: "a" }); state.push.push({ userId: "a", mobileSessionId: "old" });
    await createMobileSession("a@example.com", "password");
    expect(state.web).toEqual([]); expect(state.mobile).toHaveLength(1); expect(state.mobile[0].sessionVersion).toBe(1); expect(state.push).toEqual([]);
  });

  it("rejects stale web and mobile generations but accepts the latest generation", async () => {
    const current = user("a") as Record<string, unknown>; current.sessionVersion = 4;
    db.session.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), sessionVersion: 3, user: current }); state.cookie = "x";
    expect(await getAuthenticatedUser()).toBeNull();
    db.session.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), sessionVersion: 4, user: current }); expect(await getAuthenticatedUser()).toMatchObject({ id: "a", isActive: true, salesRole: "SALES", accountRole: null, salesAccessActive: true, accountAccessActive: false });
    db.mobileSession.findUnique.mockResolvedValue({ id: "m", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, lastUsedAt: new Date(), sessionVersion: 3, user: current });
    await expect(authenticateMobileToken(`Bearer ${"z".repeat(40)}`)).rejects.toThrow("MOBILE_UNAUTHORIZED");
    db.mobileSession.findUnique.mockResolvedValue({ id: "m", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, lastUsedAt: new Date(), sessionVersion: 4, user: current });
    await expect(authenticateMobileToken(`Bearer ${"z".repeat(40)}`)).resolves.toMatchObject({ id: "a" });
  });

  it("rejects expired and globally inactive web sessions", async () => {
    state.cookie = "x";
    db.session.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() - 1), sessionVersion: 0, user: user("a") });
    expect(await getAuthenticatedUser()).toBeNull();
    db.session.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), sessionVersion: 0, user: { ...user("a"), isActive: false } });
    expect(await getAuthenticatedUser()).toBeNull();
  });

  it("allows the same active web cookie in multiple tabs", async () => {
    const current = user("a"); current.sessionVersion = 1; state.cookie = "shared";
    db.session.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), sessionVersion: 1, user: current });
    await expect(Promise.all([getAuthenticatedUser(), getAuthenticatedUser()])).resolves.toEqual([expect.objectContaining({ id: "a" }), expect.objectContaining({ id: "a" })]);
  });

  it("serializes concurrent rotations so only the latest generation remains", async () => {
    await Promise.all([createSession("a", true, "hash-password"), createSession("a", true, "hash-password")]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2); expect(state.users.get("a")?.sessionVersion).toBe(2); expect(state.web).toHaveLength(1); expect(state.web[0].sessionVersion).toBe(2);
  });

  it("password change increments the generation and clears web, mobile, and push authentication", async () => {
    state.web.push({ userId: "a" }); state.mobile.push({ userId: "a" }); state.push.push({ userId: "a", mobileSessionId: "m" });
    await replacePasswordAndRevoke("a", "new-hash");
    expect(state.users.get("a")).toMatchObject({ passwordHash: "new-hash", sessionVersion: 1 }); expect(state.web).toEqual([]); expect(state.mobile).toEqual([]); expect(state.push).toEqual([]);
  });
});
