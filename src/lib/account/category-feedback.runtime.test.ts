import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  createCategory: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/account/service", () => ({
  createCategory: mocks.createCategory,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/account/action-feedback", () => ({
  accountErrorMessage: () =>
    "Your permission or module settings do not allow this action.",
}));
import { createCategoryWithFeedbackAction } from "@/app/actions/account-masters";
describe("A056 category creation feedback", () => {
  beforeEach(() => vi.resetAllMocks());
  it("returns duplicate feedback without leaking database detail", async () => {
    mocks.createCategory.mockRejectedValue({
      code: "P2002",
      meta: { target: "private database details" },
    });
    expect(
      await createCategoryWithFeedbackAction({ name: "Office", scope: "BOTH" }),
    ).toEqual({
      kind: "error",
      message: "A category with this name already exists. Choose another name.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("returns safe permission or module feedback without pretending creation succeeded", async () => {
    mocks.createCategory.mockRejectedValue(new Error("FORBIDDEN"));
    expect(
      (
        await createCategoryWithFeedbackAction({
          name: "Office",
          scope: "BOTH",
        })
      ).kind,
    ).toBe("error");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("returns the saved row and invalidates the category destination", async () => {
    mocks.createCategory.mockResolvedValue({ id: "saved", name: "Office" });
    expect(
      await createCategoryWithFeedbackAction({ name: "Office", scope: "BOTH" }),
    ).toEqual({ kind: "success", row: { id: "saved", name: "Office" } });
    expect(mocks.createCategory).toHaveBeenCalledWith({
      name: "Office",
      description: undefined,
      scope: "BOTH",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/workspace/account/inventory/categories",
    );
  });
});
