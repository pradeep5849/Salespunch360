import { describe, expect, it } from "vitest";
import { accountPackageCapacity, accountPackagePrice } from "@/lib/billing/account-package";
import { SALES_PRICING_INR } from "@/lib/billing/sales-pricing";
import { assertIndependentRoles, describeCompanyEntitlement, productEntitlements } from "./entitlements";

describe("F4 product entitlements", () => {
  it.each([["SALESPUNCH360", true, false], ["SALESPUNCH360_ACCOUNT", false, true], ["SALESPUNCH360_PLUS", true, true]] as const)("maps %s centrally", (edition, sales, account) => expect(productEntitlements(edition)).toMatchObject({ sales, account }));
  it("provisions the combined 15-day Plus trial", () => {
    const start = new Date("2026-09-09T00:00:00.000Z");
    const value = describeCompanyEntitlement({ id: "c", productEdition: "SALESPUNCH360_PLUS", accountPackageQuantity: 1, trialStartedAt: start, trialEndsAt: new Date(start.getTime() + 15 * 86_400_000), subscriptionStatus: "TRIAL", teamStructure: "MANAGERS_AND_SALES" }, start);
    expect(value).toMatchObject({ sales: true, account: true, source: "TRIAL", salesSeats: { manager: 1, sales: 5 }, accountPackages: 1, accountSeats: { ACCOUNT_ADMIN: 1, ACCOUNTANT: 1, DATA_ENTRY: 1, PROJECT_MANAGER: 1 } }); expect(value.trial.remainingDays).toBe(15);
  });
});

describe("F4 pricing and independent roles", () => {
  it("locks the complete Sales schedule", () => expect(SALES_PRICING_INR).toEqual({ ADMIN: { MONTHLY: 250, SIX_MONTH: 1400, YEARLY: 2800 }, MANAGER: { MONTHLY: 200, SIX_MONTH: 1100, YEARLY: 2100 }, SALES: { MONTHLY: 150, SIX_MONTH: 800, YEARLY: 1500 } }));
  it("scales only complete Account packages", () => { expect(accountPackagePrice(2)).toBe(1400); expect(accountPackageCapacity(2)).toEqual({ ACCOUNT_ADMIN: 2, ACCOUNTANT: 2, PROJECT_MANAGER: 2, DATA_ENTRY: 2 }); expect(() => accountPackageCapacity(1.5)).toThrow("INVALID_ACCOUNT_PACKAGE_QUANTITY"); });
  it("allows one role in each domain", () => expect(assertIndependentRoles({ salesRoles: ["MANAGER"], accountRoles: ["ACCOUNTANT"] })).toEqual({ salesRole: "MANAGER", accountRole: "ACCOUNTANT" }));
  it("rejects multiples in a domain", () => { expect(() => assertIndependentRoles({ salesRoles: ["MANAGER", "SALES"] })).toThrow("MULTIPLE_SALES_ROLES"); expect(() => assertIndependentRoles({ accountRoles: ["ACCOUNTANT", "DATA_ENTRY"] })).toThrow("MULTIPLE_ACCOUNT_ROLES"); });
});
