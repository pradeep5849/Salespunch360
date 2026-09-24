import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const billingHub = readFileSync("src/app/workspace/billing/page.tsx", "utf8");
const subscriptionPage = readFileSync("src/app/workspace/billing/subscription/page.tsx", "utf8");
const billingActions = readFileSync("src/app/workspace/billing/actions/page.tsx", "utf8");
const addSalesTeamPage = readFileSync("src/app/workspace/billing/add-sales-team/page.tsx", "utf8");
const renewalPage = readFileSync("src/app/workspace/billing/renewal/page.tsx", "utf8");
const calculator = readFileSync("src/app/workspace/billing/billing-calculator.tsx", "utf8");
const telecallerPage = readFileSync("src/app/workspace/billing/telecaller/page.tsx", "utf8");
const pricing = readFileSync("src/lib/billing/sales-pricing.ts", "utf8");
const telecaller = readFileSync("src/lib/billing/telecaller.ts", "utf8");
const unified = readFileSync("src/lib/billing/unified-sales-team.ts", "utf8");
const adminDashboard = readFileSync("src/lib/admin/dashboard.ts", "utf8");
const adminOrders = readFileSync("src/app/admin/billing/orders/page.tsx", "utf8");
const android = readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/SubscriptionScreen.kt", "utf8");

describe("Unified Sales-team subscription surface", () => {
  it("keeps Telecaller inside Subscription summary, Add Sales Team and Renewal instead of a third customer flow", () => {
    expect(billingHub).toContain('href="/workspace/billing/subscription"');
    expect(billingHub).toContain('href="/workspace/billing/actions"');
    expect(billingHub).not.toContain('href="/workspace/billing/telecaller"');
    expect(subscriptionPage).toContain('label="Telecaller"');
    expect(billingActions).toContain('href="/workspace/billing/add-sales-team"');
    expect(billingActions).toContain('href="/workspace/billing/renewal"');
    expect(addSalesTeamPage).toContain("AddTeamCalculator");
    expect(addSalesTeamPage).toContain("telecallerLimit");
    expect(renewalPage).toContain("BillingCalculator");
    expect(renewalPage).toContain("telecallerUsage");
    expect(calculator).toContain("Add Telecaller Seats");
    expect(calculator).toContain('name="telecallerSeats"');
    expect(telecallerPage).toContain('redirect("/workspace/billing#sales-add-team")');
  });

  it("keeps the locked Telecaller rates while co-term billing uses the Sales expiry", () => {
    expect(pricing).toContain("SIX_MONTH:600");
    expect(pricing).toContain("YEARLY:1000");
    expect(telecaller).toContain("activeSalesTerm");
    expect(telecaller).toContain("Math.min(legacy.endsAt.getTime(),salesTerm.endsAt.getTime())");
    expect(unified).toContain("UNIFIED_TELECALLER_TARGET");
    expect(unified).toContain("telecallerSubtotal");
  });

  it("includes legacy Telecaller payments in the normal Super Admin billing surfaces", () => {
    expect(adminDashboard).toContain('FROM "telecaller_billing_orders"');
    expect(adminDashboard).toContain("capturedRevenue:Number(capturedPayments._sum.amount??0)+Number(tele?.revenue??0)");
    expect(adminOrders).toContain("listTelecallerBillingOrdersForAdmin");
    expect(adminOrders).toContain("Payment History");
  });

  it("matches unified Billing actions and Renewal flow on Android", () => {
    expect(android).toContain('Text("Billing & Subscription",');
    expect(android).toContain('open("ADD_SALES")');
    expect(android).toContain('open("RENEWAL")');
    expect(android).toContain('SeatPill("Telecaller"');
    expect(android).toContain("telecallerSeats=telecallerTarget");
    expect(android).toContain("telecallerSubtotal");
  });
});
