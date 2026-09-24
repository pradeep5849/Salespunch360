import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const billingPage = readFileSync("src/app/workspace/billing/page.tsx", "utf8");
const calculator = readFileSync("src/app/workspace/billing/billing-calculator.tsx", "utf8");
const telecallerPage = readFileSync("src/app/workspace/billing/telecaller/page.tsx", "utf8");
const pricing = readFileSync("src/lib/billing/sales-pricing.ts", "utf8");
const telecaller = readFileSync("src/lib/billing/telecaller.ts", "utf8");
const unified = readFileSync("src/lib/billing/unified-sales-team.ts", "utf8");
const adminDashboard = readFileSync("src/lib/admin/dashboard.ts", "utf8");
const adminOrders = readFileSync("src/app/admin/billing/orders/page.tsx", "utf8");
const android = readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/SubscriptionScreen.kt", "utf8");

describe("Unified Sales-team subscription surface", () => {
  it("keeps Telecaller inside Add Team and Renewal instead of a third customer flow", () => {
    expect(billingPage).toContain('label="Telecaller"');
    expect(billingPage).toContain('<summary>Add Team</summary>');
    expect(billingPage).toContain("e.paidActive?'Renewal'");
    expect(billingPage).not.toContain('href="/workspace/billing/telecaller"');
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

  it("matches unified Add Team and Renewal on Android", () => {
    expect(android).toContain('Text("Add Team")');
    expect(android).toContain('SeatPill("Telecaller"');
    expect(android).toContain("telecallerSeats=telecallerTarget");
    expect(android).toContain("telecallerSubtotal");
  });
});
