import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";

const decimalFields = new Set([
  "quantity",
  "rate",
  "discountValue",
  "taxRate",
  "cessRate",
  "stockReturnQuantity",
  "freightAmount",
  "otherChargesAmount",
  "roundOffAmount",
  "tdsRate",
  "tcsRate",
]);
/** Hash the validated business intent, including ordered lines and allocations. */
export function commercialCreationHash(input: Record<string, unknown>) {
  function canonical(value: unknown, key = ""): unknown {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((row) => canonical(row));
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([field, item]) => field !== "idempotencyKey" && item !== undefined,
          )
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([field, item]) => [field, canonical(item, field)]),
      );
    if (value !== null && value !== undefined && decimalFields.has(key)) {
      const number = new Prisma.Decimal(String(value));
      if (!number.isFinite()) throw new Error("INVALID_AMOUNT");
      return number.toString();
    }
    return value;
  }
  return createHash("sha256")
    .update(JSON.stringify(canonical(input)))
    .digest("hex");
}
