import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const billingPage = readFileSync("src/app/workspace/billing/page.tsx", "utf8");
const pricing = readFileSync("src/lib/billing/sales-pricing.ts", "utf8");

describe("Telecaller subscription surface contract", () => {
  it("shows Telecaller seats in the main Billing & Subscription screen", () => {
    expect(billingPage).toContain("getTelecallerBillingOverview");
    expect(billingPage).toContain('label="Telecaller"');
    expect(billingPage).toContain('/workspace/billing/telecaller');
  });

  it("keeps the locked Telecaller pricing and no-trial message visible", () => {
    expect(pricing).toContain("SIX_MONTH:600");
    expect(pricing).toContain("YEARLY:1000");
    expect(billingPage).toContain("₹600 for 6 months");
    expect(billingPage).toContain("₹1,000 for 1 year");
    expect(billingPage).toContain("no trial");
  });
});
