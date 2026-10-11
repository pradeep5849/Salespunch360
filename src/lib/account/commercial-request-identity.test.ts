import { describe, expect, it } from "vitest";
import { commercialCreationHash } from "./commercial-request-identity";

describe("commercial creation intent", () => {
  const input = {
    type: "PURCHASE_BILL",
    branchId: "branch",
    partyId: "vendor",
    issueDate: new Date("2026-10-09"),
    lines: [{ quantity: "1", rate: "10", itemName: "01" }],
  };
  it("canonicalizes decimal fields, dates and key order without changing textual identifiers", () => {
    expect(commercialCreationHash(input)).toBe(
      commercialCreationHash({
        lines: [{ itemName: "01", rate: "10.00", quantity: "1.0000" }],
        issueDate: new Date("2026-10-09"),
        partyId: "vendor",
        branchId: "branch",
        type: "PURCHASE_BILL",
        idempotencyKey: "ignored",
      }),
    );
    expect(commercialCreationHash(input)).not.toBe(
      commercialCreationHash({
        ...input,
        lines: [{ ...input.lines[0], itemName: "1" }],
      }),
    );
  });
  it("preserves custom text even when field keys resemble financial or request keys", () => {
    const customFields={rate:"Agreed onsite",idempotencyKey:"Customer reference",quantity:"01"};
    const hash=commercialCreationHash({...input,customFields});
    expect(hash).toBe(commercialCreationHash({...input,customFields:{quantity:"01",idempotencyKey:"Customer reference",rate:"Agreed onsite"}}));
    expect(hash).not.toBe(commercialCreationHash({...input,customFields:{...customFields,quantity:"1"}}));
    expect(hash).not.toBe(commercialCreationHash({...input,customFields:{...customFields,idempotencyKey:"Different reference"}}));
  });
  it("includes allocations, Project scope and physical-return identity", () => {
    const purchase = {
      ...input,
      projectId: "A",
      lines: [
        {
          ...input.lines[0],
          purchaseAllocations: [
            { allocationType: "PROJECT", projectId: "A", quantity: "1" },
          ],
          batchId: "batch",
        },
      ],
    };
    expect(commercialCreationHash(purchase)).not.toBe(
      commercialCreationHash({ ...purchase, projectId: "B" }),
    );
    expect(commercialCreationHash(purchase)).not.toBe(
      commercialCreationHash({
        ...purchase,
        lines: [{ ...purchase.lines[0], batchId: "other" }],
      }),
    );
    expect(() => commercialCreationHash({ rate: "Infinity" })).toThrow(
      "INVALID_AMOUNT",
    );
  });
});
