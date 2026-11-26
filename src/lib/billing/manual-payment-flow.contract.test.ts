import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const service=readFileSync(new URL("./service.ts",import.meta.url),"utf8");
const actions=readFileSync(new URL("../../app/actions/billing.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../../../prisma/migrations/20260921120000_billing_order_account_price_constraint/migration.sql",import.meta.url),"utf8");

describe("online-only payment flow contract",()=>{
 it("stores account package price snapshots for web and Android orders",()=>{expect(service.match(/accountPackageUnitPrice:/g)).toHaveLength(4);expect(service).toContain("accountPackageUnitPrice:plus?")});
 it("repairs the database constraint that rejected account-only, Plus, and prorated orders",()=>{expect(migration).toContain('"accountPackages" > 0');expect(migration).toContain('"subtotal" >= 0');expect(migration).not.toContain('"subtotal" =\n    "adminUnitPrice"')});
 it("requires saved cart and removes manual approval",()=>{expect(actions).toContain("checkedCart");expect(actions).not.toContain("confirmManualPaymentAction");expect(actions).not.toContain("notifyManualPaymentOrderCreated");expect(service).not.toContain("export async function confirmManualPayment")});
 it("retains Android order entry points",()=>{expect(service).toContain("export async function createMobileBillingOrder");expect(service).toContain("source:\"ANDROID\"")});
});
