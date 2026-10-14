import { beforeEach, expect, it, vi } from "vitest";
const calls = vi.hoisted(() => ({
  permission: vi.fn(),
  post: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: calls.refresh }));
vi.mock("@/lib/auth/authorization", () => ({
  requirePermissionForMutation: calls.permission,
  AuthorizationError: class extends Error {},
}));
vi.mock("@/lib/account/money", () => ({
  postOwnerTransactionForActor: calls.post,
  createOwnerFinancialAccountForActor: calls.create,
  updateOwnerFinancialAccountForActor: calls.update,
}));
import {
  postOwnerEntryAction,
  saveOwnerIdentityAction,
} from "./owner-identity";
beforeEach(() => {
  vi.clearAllMocks();
  calls.permission.mockResolvedValue({ id: "actor" });
  calls.post.mockResolvedValue({ id: "entry" });
  calls.create.mockResolvedValue({ id: "owner" });
});
it("allows ordinary money-entry actors to post capital through the scoped service", async () => {
  const input = { type: "INVESTMENT", amount: "100" };
  expect((await postOwnerEntryAction(input)).kind).toBe("success");
  expect(calls.permission).toHaveBeenCalledWith("ACCOUNT_MONEY_ENTRY");
  expect(calls.post).toHaveBeenCalledWith({ id: "actor" }, input);
});
it("retains admin permission for owner identity creation", async () => {
  await saveOwnerIdentityAction(null, { name: "Partner" });
  expect(calls.permission).toHaveBeenCalledWith("ACCOUNT_LOAN_ADMIN");
});
it("returns actionable insufficient-funds recovery and does not refresh failed postings", async () => {
  calls.post.mockRejectedValue(new Error("INSUFFICIENT_MONEY_BALANCE"));
  const result = await postOwnerEntryAction({ amount: "101" });
  expect(result.kind).toBe("error");
  expect(result.message).toMatch(/insufficient funds/i);
  expect(calls.refresh).not.toHaveBeenCalled();
});
it("does not invoke financial posting after authorization fails", async () => {
  calls.permission.mockRejectedValue(new Error("Denied"));
  expect((await postOwnerEntryAction({})).kind).toBe("error");
  expect(calls.post).not.toHaveBeenCalled();
});
