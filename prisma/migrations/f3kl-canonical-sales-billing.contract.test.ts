import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const sql=readFileSync(new URL('./20260908020000_f3kl_canonical_sales_billing/migration.sql',import.meta.url),'utf8');
describe('F3KL additive billing migration',()=>{
 it('adds all Admin snapshot dimensions without recreating BillingRole.ADMIN',()=>{expect(sql).toContain('ADD COLUMN "adminSeats"');expect(sql).toContain('"adminUnitPrice" NUMERIC(18,2)');expect(sql).toContain('"retainAdminUserIds" UUID[]');expect(sql).not.toContain('ALTER TYPE "BillingRole" ADD VALUE')});
 it('preserves historical financial snapshots while extending paid immutability',()=>{expect(sql).not.toMatch(/DELETE FROM|TRUNCATE|DROP TABLE/);expect(sql).toContain('CREATE OR REPLACE FUNCTION prevent_paid_order_snapshot_mutation');expect(sql).toContain('NEW."adminUnitPrice"')});
 it('uses migration time and cannot close a row before its effective start',()=>{expect(sql).not.toMatch(/TIMESTAMP\s+'2026-09-08/i);expect(sql).toContain('statement_timestamp()');expect(sql).toContain('GREATEST(statement_timestamp()::timestamp, current_price."effectiveFrom" + INTERVAL \'1 millisecond\')');expect(sql).toContain('"effectiveUntil"=cutoff')});
 it('keeps exactly one current locked INR price through additive versioning',()=>{for(const row of ["'ADMIN','SIX_MONTH',1400","'ADMIN','YEARLY',2800","'MANAGER','SIX_MONTH',1100","'MANAGER','YEARLY',2100","'SALES','SIX_MONTH',800","'SALES','YEARLY',1500"])expect(sql).toContain(row);expect(sql).toContain('"effectiveUntil" IS NULL');expect(sql).toContain('FOR UPDATE')});
 it('allows legacy zero Admin snapshots but requires positive prices for purchased Admin seats',()=>{expect(sql).toContain('"adminUnitPrice" >= 0');expect(sql).toContain('(“adminSeats” = 0 OR “adminUnitPrice” > 0)'.replaceAll('“','"').replaceAll('”','"'));expect(sql).toContain('"subtotal" = "adminUnitPrice" * "adminSeats"')});
});
