import type { Role, SalesRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertOrdinaryMutationMayRemoveSalesAuthority,
  assertPrimaryAdminActor,
  assertPrimaryAdminTransferTarget,
} from "./primary-admin-policy";

const identity = (overrides: Partial<{ id: string; companyId: string | null; role: Role; salesRole: SalesRole | null; isActive: boolean; salesAccessActive: boolean }> = {}) => ({
  id: "actor", companyId: "company-a", role: "COMPANY_ADMIN" as Role, salesRole: "PRIMARY_ADMIN" as SalesRole | null,
  isActive: true, salesAccessActive: true, ...overrides,
});

describe("Primary Admin canonical policy", () => {
  it("allows only an active, Sales-active canonical Primary Admin with a company", () => {
    expect(assertPrimaryAdminActor(identity()).id).toBe("actor");
    for (const salesRole of ["ADMIN", "MANAGER", "SALES", null] as const) {
      expect(() => assertPrimaryAdminActor(identity({ salesRole }))).toThrow("NOT_AUTHORIZED");
    }
    expect(() => assertPrimaryAdminActor(identity({ salesAccessActive: false }))).toThrow("NOT_AUTHORIZED");
    expect(() => assertPrimaryAdminActor(identity({ isActive: false }))).toThrow("NOT_AUTHORIZED");
    expect(() => assertPrimaryAdminActor(identity({ companyId: null, salesRole: null, role: "COMPANY_ADMIN" }))).toThrow("NOT_AUTHORIZED");
    expect(() => assertPrimaryAdminActor(identity({ salesRole: null, role: "COMPANY_ADMIN" }))).toThrow("NOT_AUTHORIZED");
  });

  it("accepts only a different same-company active Sales-active canonical ADMIN target", () => {
    const actor = identity();
    const target = identity({ id: "target", salesRole: "ADMIN", role: "FIELD_ADMIN" });
    expect(assertPrimaryAdminTransferTarget(actor, target)).toBe(target);
    expect(() => assertPrimaryAdminTransferTarget(actor, identity())).toThrow("SELF_TRANSFER");
    for (const invalid of [
      identity({ id: "target", companyId: "company-b", salesRole: "ADMIN" }),
      identity({ id: "target", salesRole: "ADMIN", isActive: false }),
      identity({ id: "target", salesRole: "ADMIN", salesAccessActive: false }),
      identity({ id: "target", salesRole: "MANAGER" }), identity({ id: "target", salesRole: "SALES" }),
      identity({ id: "target", salesRole: null, role: "FIELD_ADMIN" }),
      identity({ id: "target", salesRole: null, role: "COMPANY_ADMIN" }), null,
    ]) expect(() => assertPrimaryAdminTransferTarget(actor, invalid)).toThrow("INVALID_TRANSFER_TARGET");
  });

  it("protects canonical Primary Admins from ordinary authority-removing mutations without trusting legacy role", () => {
    expect(() => assertOrdinaryMutationMayRemoveSalesAuthority({ salesRole: "PRIMARY_ADMIN" })).toThrow("PRIMARY_ADMIN_INVARIANT");
    expect(() => assertOrdinaryMutationMayRemoveSalesAuthority({ salesRole: "ADMIN" })).not.toThrow();
    expect(() => assertOrdinaryMutationMayRemoveSalesAuthority({ salesRole: null })).not.toThrow();
  });
});
