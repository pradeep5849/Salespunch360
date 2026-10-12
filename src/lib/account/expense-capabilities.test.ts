import { describe, it, expect } from "vitest";
import { expenseCapabilities } from "./expense-capabilities";
describe("expense lifecycle capabilities", () => {
  it.each([
    "ACCOUNT_ADMIN",
    "ACCOUNTANT",
    "PROJECT_MANAGER",
    "DATA_ENTRY",
  ] as const)(
    "keeps posted expenses immutable while restricting payment review to admin: %s",
    (accountRole) => {
      const capabilities = expenseCapabilities(
        { id: "a", accountRole },
        { status: "POSTED", createdById: "a", approvalReviewStatus: "PENDING" },
      );
      expect(capabilities).toMatchObject({
        edit: false,
        submit: false,
        cancel: false,
        post: false,
        approve: accountRole === "ACCOUNT_ADMIN",
        reject: accountRole === "ACCOUNT_ADMIN",
      });
    },
  );
  it.each([null, "NOT_REQUIRED", "APPROVED", "REJECTED", "CANCELLED"] as const)(
    "does not expose a completed or absent posted review: %s",
    (approvalReviewStatus) => {
      expect(
        expenseCapabilities(
          { id: "a", accountRole: "ACCOUNT_ADMIN" },
          { status: "POSTED", createdById: "a", approvalReviewStatus },
        ),
      ).toMatchObject({ approve: false, reject: false, post: false });
    },
  );
  it("limits edits to creator drafts", () => {
    expect(
      expenseCapabilities(
        { id: "a", accountRole: "ACCOUNT_ADMIN" },
        { status: "DRAFT", createdById: "a" },
      ).edit,
    ).toBe(true);
    expect(
      expenseCapabilities(
        { id: "a", accountRole: "ACCOUNT_ADMIN" },
        { status: "DRAFT", createdById: "b" },
      ).edit,
    ).toBe(false);
    expect(
      expenseCapabilities(
        { id: "a", accountRole: "ACCOUNT_ADMIN" },
        { status: "POSTED", createdById: "a" },
      ).edit,
    ).toBe(false);
  });
  it.each(["ACCOUNTANT", "PROJECT_MANAGER", "DATA_ENTRY"] as const)(
    "does not expose approval or reversal to %s",
    (accountRole) => {
      const a = { id: "a", accountRole };
      expect(
        expenseCapabilities(a, { status: "PENDING_APPROVAL", createdById: "a" })
          .approve,
      ).toBe(false);
      expect(
        expenseCapabilities(a, { status: "POSTED", createdById: "a" }).reverse,
      ).toBe(false);
    },
  );
  it("allows accountant posting and PM cancellation but not PM posting", () => {
    expect(
      expenseCapabilities(
        { id: "a", accountRole: "ACCOUNTANT" },
        { status: "APPROVED", createdById: "a" },
      ).post,
    ).toBe(true);
    expect(
      expenseCapabilities(
        { id: "a", accountRole: "PROJECT_MANAGER" },
        { status: "APPROVED", createdById: "a" },
      ).post,
    ).toBe(false);
    expect(
      expenseCapabilities(
        { id: "a", accountRole: "PROJECT_MANAGER" },
        { status: "DRAFT", createdById: "a" },
      ).cancel,
    ).toBe(true);
  });
  it.each(["REJECTED", "REVERSED", "CANCELLED"] as const)(
    "exposes no financial actions for terminal %s",
    (status) => {
      const c = expenseCapabilities(
        { id: "a", accountRole: "ACCOUNT_ADMIN" },
        { status, createdById: "a" },
      );
      expect(c).toMatchObject({
        edit: false,
        submit: false,
        cancel: false,
        approve: false,
        reject: false,
        post: false,
        reverse: false,
      });
    },
  );
});
