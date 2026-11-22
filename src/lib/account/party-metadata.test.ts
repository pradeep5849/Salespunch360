import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  actor: vi.fn(),
  user: vi.fn(),
  find: vi.fn(),
  vendorFind: vi.fn(),
  update: vi.fn(),
  vendorUpdate: vi.fn(),
  saved: vi.fn(),
  audit: vi.fn(),
  transaction: vi.fn(),
  raw: vi.fn(),
  settings: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: m.actor,
  requirePermissionForMutation: m.actor,
}));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: m.transaction,
    customer: { findFirst: m.find },
    vendor: { findFirst: m.vendorFind },
    accountSettings: { findUnique: m.settings },
  },
}));
import {
  editPartyMetadataForActor,
  partyMetadataForEdit,
} from "./party-metadata";
const actor = {
    id: "00000000-0000-4000-8000-000000000001",
    companyId: "00000000-0000-4000-8000-000000000002",
  },
  id = "00000000-0000-4000-8000-000000000003";
const revision = "2026-11-01T00:00:00.000Z",
  next = "2026-11-02T00:00:00.000Z";
const input = { id, expectedUpdatedAt: revision, name: "Business" };
beforeEach(() => {
  vi.clearAllMocks();
  m.actor.mockResolvedValue({ ...actor, branchAccessScope: "ALL_BRANCHES" });
  m.settings.mockResolvedValue(null);
  m.user.mockResolvedValue({
    accountRole: "ACCOUNT_ADMIN",
    branchAccessScope: "ALL_BRANCHES",
    branchAccesses: [],
  });
  m.find.mockResolvedValue({ id, updatedAt: new Date(revision) });
  m.vendorFind.mockResolvedValue({ id, updatedAt: new Date(revision) });
  m.update.mockResolvedValue({ count: 1 });
  m.vendorUpdate.mockResolvedValue({ count: 1 });
  m.saved.mockResolvedValue({ updatedAt: new Date(next) });
  m.transaction.mockImplementation((work) =>
    work({
      $queryRaw: m.raw,
      user: { findFirst: m.user },
      customer: {
        findFirst: m.find,
        updateMany: m.update,
        findFirstOrThrow: m.saved,
      },
      vendor: {
        findFirst: m.vendorFind,
        updateMany: m.vendorUpdate,
        findFirstOrThrow: m.saved,
      },
      accountOperationalAudit: { create: m.audit },
    }),
  );
});
it("edits only provided customer metadata, keeps geographic address separate, and audits the actor", async () => {
  expect(
    await editPartyMetadataForActor(actor, "customers", {
      ...input,
      address: "Billing address",
      phone: "",
      email: "CONTACT@EXAMPLE.INVALID",
    }),
  ).toEqual({ updatedAt: next });
  expect(m.update).toHaveBeenCalledWith({
    where: {
      id,
      companyId: actor.companyId,
      isAccountCustomer: true,
      updatedAt: new Date(revision),
    },
    data: {
      name: "Business",
      billingAddress: "Billing address",
      phone: null,
      email: "contact@example.invalid",
    },
  });
  expect(m.audit).toHaveBeenCalledWith({
    data: expect.objectContaining({
      companyId: actor.companyId,
      actorUserId: actor.id,
      eventType: "PARTY_METADATA_UPDATED",
      entityId: id,
    }),
  });
});
it("preserves omitted tax, shipping and assignment fields", async () => {
  await editPartyMetadataForActor(actor, "customers", input);
  expect(m.update.mock.calls[0][0].data).toEqual({ name: "Business" });
});
it("restricts customers by the fresh live user branch scope", async () => {
  m.user.mockResolvedValue({
    accountRole: "ACCOUNTANT",
    branchAccessScope: "SELECTED_BRANCHES",
    branchAccesses: [{ branchId: "allowed" }],
  });
  await editPartyMetadataForActor(actor, "customers", input);
  expect(m.find.mock.calls[0][0].where).toMatchObject({
    companyId: actor.companyId,
    isAccountCustomer: true,
    branchId: { in: ["allowed"] },
  });
  expect(m.update.mock.calls[0][0].where.branchId).toEqual({ in: ["allowed"] });
});
it("does not read or write a party when current Account permission is absent", async () => {
  m.user.mockResolvedValue({
    accountRole: "PROJECT_MANAGER",
    branchAccessScope: "ALL_BRANCHES",
    branchAccesses: [],
  });
  await expect(
    editPartyMetadataForActor(actor, "customers", input),
  ).rejects.toThrow();
  expect(m.find).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects missing/foreign/non-Account customers before a write", async () => {
  m.find.mockResolvedValue(null);
  await expect(
    editPartyMetadataForActor(actor, "customers", input),
  ).rejects.toThrow("PARTY_NOT_FOUND");
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects a stale revision before a write and a lost conditional-update race before audit", async () => {
  await expect(
    editPartyMetadataForActor(actor, "customers", {
      ...input,
      expectedUpdatedAt: next,
    }),
  ).rejects.toThrow("PARTY_STALE");
  expect(m.update).not.toHaveBeenCalled();
  m.update.mockResolvedValue({ count: 0 });
  await expect(
    editPartyMetadataForActor(actor, "customers", input),
  ).rejects.toThrow("PARTY_STALE");
  expect(m.audit).not.toHaveBeenCalled();
});
it.each([
  { companyId: "foreign" },
  { branchId: "foreign" },
  { assignedUserId: "other" },
  { isAccountCustomer: false },
  { balanceDue: "0" },
  { creationRequestKey: "key" },
])("rejects non-metadata field injection %j", async (extra) => {
  await expect(
    editPartyMetadataForActor(actor, "customers", { ...input, ...extra }),
  ).rejects.toThrow();
  expect(m.transaction).not.toHaveBeenCalled();
});
it("updates company-scoped vendor metadata without using customer fields", async () => {
  await editPartyMetadataForActor(actor, "vendors", {
    ...input,
    address: "Address",
    notes: "",
  });
  expect(m.vendorUpdate).toHaveBeenCalledWith({
    where: { id, companyId: actor.companyId, updatedAt: new Date(revision) },
    data: { name: "Business", address: "Address", notes: null },
  });
  expect(m.update).not.toHaveBeenCalled();
});
it("rejects vendor shipping fields before transaction work", async () => {
  await expect(
    editPartyMetadataForActor(actor, "vendors", {
      ...input,
      shippingAddress: "no",
    }),
  ).rejects.toThrow("INVALID_INPUT");
  expect(m.transaction).not.toHaveBeenCalled();
});

it("uses the existing party settings source and authorized branch on editor reads", async () => {
  m.actor.mockResolvedValue({
    ...actor,
    branchAccessScope: "SELECTED_BRANCHES",
    branchIds: ["allowed"],
  });
  m.settings.mockResolvedValue({
    transactionDefaults: {
      partySettings: {
        gstinEnabled: false,
        groupingEnabled: false,
        shippingAddressEnabled: false,
        printShippingAddress: false,
      },
    },
  });
  const result = await partyMetadataForEdit("customers", id);
  expect(result.settings.gstinEnabled).toBe(false);
  expect(result.settings.shippingAddressEnabled).toBe(false);
  expect(m.find.mock.calls[0][0].where).toEqual({
    id,
    companyId: actor.companyId,
    isAccountCustomer: true,
    branchId: { in: ["allowed"] },
  });
  expect(m.find.mock.calls[0][0].select.creationRequestHash).toBeUndefined();
  expect(m.settings).toHaveBeenCalledWith({
    where: { companyId: actor.companyId },
    select: { transactionDefaults: true },
  });
});
it("requires editor permission before reading party data", async () => {
  m.actor.mockRejectedValue(new Error("denied"));
  await expect(partyMetadataForEdit("vendors", id)).rejects.toThrow("denied");
  expect(m.vendorFind).not.toHaveBeenCalled();
  expect(m.settings).not.toHaveBeenCalled();
});
