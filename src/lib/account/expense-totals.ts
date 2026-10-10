import { Prisma } from "@prisma/client";
import { z } from "zod";
import { calculateTax, type TaxInput } from "./tax-calculation";
const positiveQuantity = z
  .string()
  .regex(/^\d{1,14}(\.\d{1,4})?$/)
  .refine((v) => new Prisma.Decimal(v).gt(0), "Quantity must be positive");
const amount = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);
export const billedItemSchema = z
  .object({
    name: z.string().trim().min(1).max(240),
    quantity: positiveQuantity,
    rate: amount,
  })
  .strict();
export function expenseTotals(
  input: TaxInput & {
    billedItems?: Array<z.infer<typeof billedItemSchema>>;
    additionalCharges?: string;
    roundOffEnabled?: boolean;
  },
) {
  const billedItems = z
    .array(billedItemSchema)
    .max(200)
    .parse(input.billedItems ?? []);
  const lineTotal = billedItems.length
    ? billedItems.reduce(
        (sum, line) =>
          sum.add(
            new Prisma.Decimal(line.quantity).mul(line.rate).toDecimalPlaces(2),
          ),
        new Prisma.Decimal(0),
      )
    : input.amount;
  const charges = new Prisma.Decimal(
    amount.parse(input.additionalCharges ?? "0"),
  );
  const entered = lineTotal.add(charges);
  if (entered.lte(0)) throw new Error("INVALID_EXPENSE_AMOUNT");
  const tax = calculateTax({ ...input, amount: entered });
  const total = input.roundOffEnabled
    ? tax.grandTotal.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    : tax.grandTotal;
  if (total.lte(0) || total.gt("9999999999999999.99"))
    throw new Error("INVALID_EXPENSE_AMOUNT");
  return {
    ...tax,
    billedItems,
    additionalCharges: charges,
    roundOffAmount: total.sub(tax.grandTotal),
    grandTotal: total,
  };
}
