import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const service=readFileSync(new URL("./service.ts",import.meta.url),"utf8");
const actions=readFileSync(new URL("../../app/actions/billing.ts",import.meta.url),"utf8");
const email=readFileSync(new URL("./manual-payment-email.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../../../prisma/migrations/20260921120000_billing_order_account_price_constraint/migration.sql",import.meta.url),"utf8");

describe("manual-payment flow contract",()=>{
 it("stores account package price snapshots for web and Android orders",()=>{expect(service.match(/accountPackageUnitPrice:/g)).toHaveLength(4);expect(service).toContain("accountPackageUnitPrice:plus?")});
 it("repairs the database constraint that rejected account-only, Plus, and prorated orders",()=>{expect(migration).toContain('"accountPackages" > 0');expect(migration).toContain('"subtotal" >= 0');expect(migration).not.toContain('"subtotal" =\n    "adminUnitPrice"')});
 it("keeps redirects outside successful mutation work and logs sanitized failures",()=>{expect(actions).toContain("logBillingFailure('CREATE_MANUAL_ORDER','createBillingOrder',error)");expect(actions).toContain("revalidatePath('/workspace/billing');redirect(`/workspace/billing/pending?order=${orderId}`)")});
 it("sends creation mail after PENDING creation",()=>{expect(actions.indexOf("createBillingOrder({")).toBeLessThan(actions.indexOf("notifyManualPaymentOrderCreated(order.id)"));expect(email).toContain('order.status!=="PENDING"')});
 it("sends approval mail only after authoritative payment activation succeeds",()=>{expect(actions.indexOf("confirmManualPayment(String")).toBeLessThan(actions.indexOf("notifyManualPaymentOrderApproved(order.id,reference)"));expect(email).toContain('order.status!=="PAID"')});
 it("retains Android order entry points",()=>{expect(service).toContain("export async function createMobileBillingOrder");expect(service).toContain("source:\"ANDROID\"")});
});
