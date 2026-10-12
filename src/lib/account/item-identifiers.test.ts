import { describe, expect, it, vi } from "vitest";
import {
  generateItemCode,
  rethrowItemIdentifierConflict,
} from "./item-identifiers";
describe("item identifiers", () => {
  it("uses a complete random identifier with an explicit type prefix", () => {
    const uuid = () => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(generateItemCode("products", uuid)).toBe(
      "ITEM-AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
    );
    expect(generateItemCode("services", uuid)).toBe(
      "SER-AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
    );
  });
  it("does not collide when the clock repeats and stays within database length", () => {
    vi.spyOn(Date, "now").mockReturnValue(0);
    try {
      const codes = Array.from({ length: 1000 }, () =>
        generateItemCode("products"),
      );
      expect(new Set(codes).size).toBe(1000);
      expect(codes.every((code) => code.length <= 60)).toBe(true);
    } finally {
      vi.restoreAllMocks();
    }
  });
  it.each(["code", "barcode"])(
    "maps authoritative %s unique rejection to actionable feedback",
    (field) => {
      expect(() =>
        rethrowItemIdentifierConflict({
          code: "P2002",
          meta: { target: ["companyId", field] },
        }),
      ).toThrow("ITEM_IDENTIFIER_EXISTS");
    },
  );
  it("does not misclassify unrelated constraints or database failures", () => {
    const error = { code: "P2002", meta: { target: ["name"] } };
    try {
      rethrowItemIdentifierConflict(error);
    } catch (caught) {
      expect(caught).toBe(error);
    }
  });
});
