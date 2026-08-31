import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRIAL_DURATION_MS } from "@/lib/trial/config";
import { getTrialStatus } from "@/lib/trial/status";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), hashPassword: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
vi.mock("./crypto", () => ({ hashPassword: mocks.hashPassword }));

import { registerCompany } from "./registration";

const base = {
  companyName: "Acme Sales",
  adminName: "Ada Admin",
  adminEmail: "ada@example.com",
  adminPassword: "StrongPassword1",
  confirmPassword: "StrongPassword1",
} as const;

function transactionHarness() {
  const tx = {
    company: { create: vi.fn(async ({ data }) => ({ id: "company-id", ...data })) },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(async () => ({ id: "admin-id", role: "COMPANY_ADMIN", companyId: "company-id" })),
    },
    companySubscription: { create: vi.fn() },
  };
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hashPassword.mockResolvedValue("password-hash");
});

describe("registration trial setup", () => {
  it("creates one 15-day trial without accepting a registration team structure", async () => {
    const tx = transactionHarness();
    const { company, user } = await registerCompany(base);

    expect(company.trialEndsAt!.getTime() - company.trialStartedAt!.getTime()).toBe(TRIAL_DURATION_MS);
    expect(company.subscriptionStatus).toBe("TRIAL");
    expect(tx.company.create).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(user.role).toBe("COMPANY_ADMIN");
    expect(tx.companySubscription.create).not.toHaveBeenCalled();

    expect(tx.company.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.not.objectContaining({teamStructure:expect.anything()})}));
    const trial = getTrialStatus({...company,teamStructure:"MANAGERS_AND_SALES"}, company.trialStartedAt!);
    expect(trial.managerAllowance).toBe(1);
    expect(trial.salesAllowance).toBe(5);
  });
});
