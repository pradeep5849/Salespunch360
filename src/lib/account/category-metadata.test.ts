import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  actor: vi.fn(),
  inventory: vi.fn(),
  update: vi.fn(),
  saved: vi.fn(),
  user: vi.fn(),
  raw: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermissionForMutation: m.actor,
}));
vi.mock("./inventory", () => ({ assertInventoryAvailable: m.inventory }));
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction } }));
import { editCategoryMetadata } from "./category-metadata";
const input = {
  id: "00000000-0000-4000-8000-000000000003",
  expectedUpdatedAt: "2026-11-22T00:00:00.000Z",
  name: " Updated ",
  description: " Notes ",
};
beforeEach(() => {
  vi.clearAllMocks();
  m.actor.mockResolvedValue({ id: "actor", companyId: "tenant" });
  m.inventory.mockResolvedValue(undefined);
  m.user.mockResolvedValue({ accountRole: "ACCOUNT_ADMIN" });
  m.update.mockResolvedValue({ count: 1 });
  m.saved.mockResolvedValue({
    id: input.id,
    name: "Updated",
    description: "Notes",
    scope: "BOTH",
    updatedAt: new Date(input.expectedUpdatedAt),
  });
  m.transaction.mockImplementation((fn) =>
    fn({
      $queryRaw: m.raw,
      user: { findFirst: m.user },
      accountCategory: { updateMany: m.update, findFirstOrThrow: m.saved },
    }),
  );
});
it("limits updates to active company row and expected revision, preserving scope and links", async () => {
  await editCategoryMetadata(input);
  expect(m.actor).toHaveBeenCalledWith("ACCOUNT_STOCK");
  expect(m.update).toHaveBeenCalledWith({
    where: {
      id: input.id,
      companyId: "tenant",
      isActive: true,
      updatedAt: new Date(input.expectedUpdatedAt),
    },
    data: { name: "Updated", description: "Notes" },
  });
});
it("rejects stale, missing and foreign rows without returning saved data", async () => {
  m.update.mockResolvedValue({ count: 0 });
  await expect(editCategoryMetadata(input)).rejects.toThrow("CATEGORY_STALE");
  expect(m.saved).not.toHaveBeenCalled();
});
it("rechecks revoked access inside the locked mutation", async () => {
  m.user.mockResolvedValue(null);
  await expect(editCategoryMetadata(input)).rejects.toThrow();
  expect(m.update).not.toHaveBeenCalled();
});
it("checks inventory availability before mutation", async () => {
  m.inventory.mockRejectedValue(new Error("DISABLED"));
  await expect(editCategoryMetadata(input)).rejects.toThrow("DISABLED");
  expect(m.transaction).not.toHaveBeenCalled();
});
it("rejects arbitrary scope and relation changes", async () => {
  await expect(
    editCategoryMetadata({ ...input, scope: "SERVICE" }),
  ).rejects.toThrow();
  expect(m.transaction).not.toHaveBeenCalled();
});
it("allows clearing description but rejects empty names", async () => {
  await editCategoryMetadata({ ...input, description: " " });
  expect(m.update.mock.calls[0][0].data.description).toBeNull();
  await expect(editCategoryMetadata({ ...input, name: " " })).rejects.toThrow();
});
