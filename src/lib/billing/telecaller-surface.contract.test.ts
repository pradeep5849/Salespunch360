import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const billingPage = readFileSync("src/app/workspace/billing/page.tsx", "utf8");
const calculator = readFileSync("src/app/workspace/billing/billing-calculator.tsx", "utf8");
const legacyPage = readFileSync("src/app/workspace/billing/telecaller/page.tsx", "utf8");
const pricing = readFileSync("src/lib/billing/sales-pricing.ts", "utf8");

describe("Telecaller subscription surface contract", () => {
  it("keeps Telecaller seats in the main Sales subscription", () => {
    expect(billingPage).toContain("getTelecallerBillingOverview");
    expect(billingPage).toContain('label="Telecaller"');
    expect(billingPage).toContain('<summary>Add Team</summary>');
    expect(billingPage).toContain("Renewal");
    expect(billingPage).not.toContain('href="/workspace/billing/telecaller"');
    expect(legacyPage).toContain("/workspace/billing#sales-add-team");
  });

  it("keeps the locked Telecaller pricing inside Add Team and Renewal", () => {
    expect(pricing).toContain("SIX_MONTH:600");
    expect(pricing).toContain("YEARLY:1000");
    expect(calculator).toContain("SIX_MONTH:600");
    expect(calculator).toContain("YEARLY:1000");
    expect(calculator).toContain("Add Telecaller Seats");
    expect(calculator).toContain("Telecaller Seats");
  });
});
