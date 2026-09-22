import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { partySchema, itemSchema } from "@/lib/account/validation";
import { canUsePermission } from "@/lib/auth/permissions";
import { enabledModulesForCompany } from "@/lib/account/modules";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import type { MobileAppPrincipal } from "./auth";

type MasterKind = "customers" | "vendors" | "items" | "warehouses";
const warehouseSchema = z.object({ branchId: z.string().uuid(), name: z.string().trim().min(1).max(160), code: z.string().trim().min(1).max(60), address: z.string().trim().max(2000).optional(), isDefault: z.boolean().default(false), isActive: z.boolean().optional() });
const itemMobileSchema = itemSchema.extend({ barcode: z.string().trim().max(120).optional(), trackInventory: z.boolean().default(false), trackingMode: z.enum(["NONE", "BATCH", "SERIAL"]).default("NONE"), lowStockThreshold: z.coerce.number().min(0).max(99999999999999).default(0), isActive: z.boolean().optional() });

function actor(user: MobileAppPrincipal, kind: MasterKind, write = false) {
  if (!user.authorizedWorkspaces.includes("ACCOUNT") || !user.accountRole) throw new Error("MOBILE_FORBIDDEN");
  const principal = { ...user, isActive: true, salesAccessActive: user.authorizedWorkspaces.includes("SALES"), accountAccessActive: true };
  const permission = kind === "warehouses" || kind === "items" ? "ACCOUNT_STOCK" : "ACCOUNT_ACCOUNTS";
  if (!canUsePermission(principal, user.productEdition, permission)) throw new Error("MOBILE_FORBIDDEN");
  if (write && user.accountRole === "PROJECT_MANAGER") throw new Error("MOBILE_FORBIDDEN");
  return principal;
}
const branchFilter = (user: MobileAppPrincipal) => user.branchAccessScope === "SELECTED_BRANCHES" ? { branchId: { in: user.branchIds ?? [] } } : {};
const text = (value: Prisma.Decimal | null | undefined) => value?.toString() ?? null;

export async function listMobileAccountMaster(user: MobileAppPrincipal, kind: MasterKind, query: { q?: string | null; active?: string | null; branchId?: string | null }) {
  actor(user, kind);
  const q = query.q?.trim().slice(0, 120), active = query.active === "all" ? undefined : query.active === "false" ? false : true;
  if (query.branchId && !(user.branchIds ?? []).includes(query.branchId)) throw new Error("MOBILE_FORBIDDEN");
  if (kind === "customers") return db.customer.findMany({ where: { companyId: user.companyId, isAccountCustomer: true, ...(active === undefined ? {} : { isActive: active }), ...branchFilter(user), ...(query.branchId ? { branchId: query.branchId } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { contactPerson: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }, { gstin: { contains: q, mode: "insensitive" } }] } : {}) }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 200, select: { id: true, branchId: true, name: true, contactPerson: true, phone: true, email: true, address: true, billingAddress: true, shippingAddress: true, gstin: true, stateCode: true, gstRegistrationType: true, pan: true, notes: true, isActive: true, updatedAt: true } });
  if (kind === "vendors") return db.vendor.findMany({ where: { companyId: user.companyId, ...(active === undefined ? {} : { isActive: active }), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { contactPerson: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }, { gstin: { contains: q, mode: "insensitive" } }] } : {}) }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 200 });
  if (kind === "items") { await requireInventory(user); const rows = await db.accountProduct.findMany({ where: { companyId: user.companyId, ...(active === undefined ? {} : { isActive: active }), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { barcode: { contains: q } }, { hsnCode: { contains: q } }] } : {}) }, include: { unit: { select: { id: true, name: true, symbol: true } }, category: { select: { id: true, name: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 200 }); return rows.map(row => ({ ...row, salePrice: text(row.salePrice), costPrice: text(row.costPrice), taxRate: text(row.taxRate), lowStockThreshold: text(row.lowStockThreshold) })); }
  await requireInventory(user); return db.warehouse.findMany({ where: { companyId: user.companyId, ...branchFilter(user), ...(query.branchId ? { branchId: query.branchId } : {}), ...(active === undefined ? {} : { isActive: active }), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { address: { contains: q, mode: "insensitive" } }] } : {}) }, orderBy: [{ branchId: "asc" }, { name: "asc" }], take: 200 });
}

export async function getMobileAccountMaster(user: MobileAppPrincipal, kind: MasterKind, id: string) {
  actor(user, kind); if (!z.string().uuid().safeParse(id).success) throw new Error("INVALID_INPUT");
  const rows = await listMobileAccountMaster(user, kind, { active: "all" }); const record = (rows as Array<{ id: string }>).find(row => row.id === id); if (!record) throw new Error("MOBILE_FORBIDDEN");
  if (kind !== "customers" && kind !== "vendors") return { record };
  const party = kind === "customers" ? { customerId: id } : { vendorId: id };
  const [documents, settlements] = await Promise.all([
    db.commercialDocument.findMany({ where: { companyId: user.companyId, ...party, ...(kind === "customers" ? branchFilter(user) : {}) }, orderBy: [{ issueDate: "desc" }, { id: "desc" }], take: 50, select: { id: true, type: true, documentNumber: true, issueDate: true, status: true, grandTotal: true, balanceDue: true } }),
    db.accountSettlement.findMany({ where: { companyId: user.companyId, ...party, ...(kind === "customers" ? branchFilter(user) : {}) }, orderBy: [{ transactionDate: "desc" }, { id: "desc" }], take: 50, select: { id: true, type: true, settlementNumber: true, transactionDate: true, amount: true } }),
  ]);
  return { record, documents: documents.map(x => ({ ...x, grandTotal: text(x.grandTotal), balanceDue: text(x.balanceDue) })), settlements: settlements.map(x => ({ ...x, amount: text(x.amount) })) };
}

export async function saveMobileAccountMaster(user: MobileAppPrincipal, kind: MasterKind, raw: unknown, id?: string) {
  actor(user, kind, true); await assertOperationalWrite(user.companyId); if (id && !z.string().uuid().safeParse(id).success) throw new Error("INVALID_INPUT");
  if (kind === "customers" || kind === "vendors") {
    const input = partySchema.extend({ branchId: z.string().uuid().optional(), isActive: z.boolean().optional() }).parse(raw);
    if (kind === "customers") { const branchId = input.branchId; if (!branchId || !(user.branchIds ?? []).includes(branchId) || !await db.branch.findFirst({ where: { id: branchId, companyId: user.companyId, isActive: true } })) throw new Error("MOBILE_FORBIDDEN"); const data = { name: input.name, contactPerson: input.contactPerson, phone: input.phone, email: input.email, address: input.address, billingAddress: input.address, shippingAddress: input.shippingAddress, gstin: input.gstin, stateCode: input.stateCode, gstRegistrationType: input.gstRegistrationType, pan: input.pan, notes: input.notes, ...(input.isActive === undefined ? {} : { isActive: input.isActive }) }; if (!id) return db.customer.create({ data: { ...data, branchId, companyId: user.companyId, isAccountCustomer: true } }); const changed = await db.customer.updateMany({ where: { id, companyId: user.companyId, isAccountCustomer: true, ...branchFilter(user) }, data }); if (changed.count !== 1) throw new Error("MOBILE_FORBIDDEN"); return getMobileAccountMaster(user, kind, id); }
    const data = { name: input.name, contactPerson: input.contactPerson, phone: input.phone, email: input.email, address: input.address, gstin: input.gstin, stateCode: input.stateCode, gstRegistrationType: input.gstRegistrationType, pan: input.pan, notes: input.notes, ...(input.isActive === undefined ? {} : { isActive: input.isActive }) }; if (!id) return db.vendor.create({ data: { ...data, companyId: user.companyId } }); const changed = await db.vendor.updateMany({ where: { id, companyId: user.companyId }, data }); if (changed.count !== 1) throw new Error("MOBILE_FORBIDDEN"); return getMobileAccountMaster(user, kind, id);
  }
  await requireInventory(user);
  if (kind === "items") { const input = itemMobileSchema.parse(raw); if (input.categoryId && !await db.accountCategory.findFirst({ where: { id: input.categoryId, companyId: user.companyId, isActive: true, scope: { in: ["PRODUCT", "BOTH"] } } })) throw new Error("INVALID_INPUT"); if (input.unitId && !await db.accountUnit.findFirst({ where: { id: input.unitId, companyId: user.companyId, isActive: true } })) throw new Error("INVALID_INPUT"); if (!input.trackInventory && input.trackingMode !== "NONE") throw new Error("INVALID_INPUT"); const data = { name: input.name, code: input.code, categoryId: input.categoryId, unitId: input.unitId, description: input.description, salePrice: input.sellingRate, costPrice: input.cost, taxRate: input.taxRate, hsnCode: input.hsnSacCode, barcode: input.barcode, trackInventory: input.trackInventory, trackingMode: input.trackingMode, lowStockThreshold: input.lowStockThreshold, ...(input.isActive === undefined ? {} : { isActive: input.isActive }) }; if (!id) return db.accountProduct.create({ data: { ...data, companyId: user.companyId } }); const changed = await db.accountProduct.updateMany({ where: { id, companyId: user.companyId }, data }); if (changed.count !== 1) throw new Error("MOBILE_FORBIDDEN"); return getMobileAccountMaster(user, kind, id); }
  const input = warehouseSchema.parse(raw); if (!(user.branchIds ?? []).includes(input.branchId) || !await db.branch.findFirst({ where: { id: input.branchId, companyId: user.companyId, isActive: true } })) throw new Error("MOBILE_FORBIDDEN"); return db.$transaction(async tx => { if (input.isDefault) await tx.warehouse.updateMany({ where: { companyId: user.companyId, branchId: input.branchId, isDefault: true, ...(id ? { id: { not: id } } : {}) }, data: { isDefault: false } }); if (!id) return tx.warehouse.create({ data: { ...input, companyId: user.companyId } }); const changed = await tx.warehouse.updateMany({ where: { id, companyId: user.companyId, ...branchFilter(user) }, data: input }); if (changed.count !== 1) throw new Error("MOBILE_FORBIDDEN"); return tx.warehouse.findUniqueOrThrow({ where: { id } }); });
}

export async function mobileMasterOptions(user: MobileAppPrincipal) { actor(user, "customers"); const [branches, units, categories] = await Promise.all([db.branch.findMany({ where: { companyId: user.companyId, isActive: true, ...(user.branchAccessScope === "SELECTED_BRANCHES" ? { id: { in: user.branchIds ?? [] } } : {}) }, select: { id: true, name: true }, orderBy: { name: "asc" } }), db.accountUnit.findMany({ where: { companyId: user.companyId, isActive: true }, select: { id: true, name: true, symbol: true }, orderBy: { name: "asc" } }), db.accountCategory.findMany({ where: { companyId: user.companyId, isActive: true, scope: { in: ["PRODUCT", "BOTH"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } })]); return { branches, units, categories }; }
async function requireInventory(user: MobileAppPrincipal) { if (!(await enabledModulesForCompany(user.companyId)).includes("INVENTORY")) throw new Error("MOBILE_FORBIDDEN"); }
export const MOBILE_MASTER_KINDS = new Set<MasterKind>(["customers", "vendors", "items", "warehouses"]);
