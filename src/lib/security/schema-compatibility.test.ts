import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCustomerSchema } from "@/lib/customers/validation";
import { journalLineSchema } from "@/lib/accounting/validation";

describe("patched schema validation compatibility", () => {
  it("rejects an oversized financial collection before validating every child", () => {
    let visited = 0;
    const line = z.unknown().superRefine(() => {
      visited += 1;
    });
    const result = z.array(line).max(500).safeParse(Array(100_000).fill(null));
    expect(result.success).toBe(false);
    expect(visited).toBe(0);
    if (!result.success) expect(result.error.issues).toHaveLength(1);
  });

  it("keeps PostgreSQL GUID acceptance without requiring an RFC version nibble", () => {
    const result = journalLineSchema.parse({
      ledgerAccountId: "11111111-1111-1111-1111-111111111111",
      debit: "100.00",
    });
    expect(result.credit).toBe("0");
    expect(result.debit).toBe("100.00");
    expect(
      journalLineSchema.safeParse({ ledgerAccountId: "invalid", debit: "1" })
        .success,
    ).toBe(false);
  });

  it("requires a normalized customer phone even when the shared phone schema is optional", () => {
    for (const phone of [undefined, "", "   ", null, "invalid"]) {
      expect(
        createCustomerSchema.safeParse({ name: "Acme", phone }).success,
      ).toBe(false);
    }
    expect(
      createCustomerSchema.parse({ name: "Acme", phone: "+1 202-555-0110" })
        .phone,
    ).toBe("+12025550110");
  });

  it("still parses and transforms defaults instead of bypassing validation", () => {
    const schema = z.string().trim().toUpperCase().min(2).prefault(" ab ");
    expect(schema.parse(undefined)).toBe("AB");
    expect(z.string().min(2).prefault("x").safeParse(undefined).success).toBe(
      false,
    );
    expect(z.object({ code: schema }).prefault({}).parse(undefined)).toEqual({
      code: "AB",
    });
  });
});
