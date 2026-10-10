import { Prisma, type TaxMode } from "@prisma/client";
const D = Prisma.Decimal,
  Z = new D(0),
  round = (x: Prisma.Decimal) =>
    x.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export type TaxInput = {
  amount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  cessRate?: Prisma.Decimal;
  cessFixed?: Prisma.Decimal;
  taxMode: TaxMode;
  sellerStateCode?: string | null;
  stateOfSupplyCode?: string | null;
  reverseCharge?: boolean;
  composition?: boolean;
  itcEligible?: boolean;
};
export function calculateTax(i: TaxInput) {
  if (i.amount.lt(0) || i.taxRate.lt(0)) throw new Error("INVALID_TAX_INPUT");
  const cessRate = i.cessRate ?? Z,
    cessFixed = i.cessFixed ?? Z,
    denominator = new D(100).add(i.taxRate).add(cessRate),
    taxable = round(
      i.taxMode === "INCLUSIVE"
        ? i.amount.sub(cessFixed).mul(100).div(denominator)
        : i.amount,
    ),
    gst = round(taxable.mul(i.taxRate).div(100)),
    cess = round(taxable.mul(cessRate).div(100).add(cessFixed)),
    interstate =
      !!i.sellerStateCode &&
      !!i.stateOfSupplyCode &&
      i.sellerStateCode !== i.stateOfSupplyCode,
    composition = !!i.composition,
    chargeableGst = composition ? Z : gst,
    cgst = interstate ? Z : round(chargeableGst.div(2)),
    sgst = interstate ? Z : chargeableGst.sub(cgst),
    igst = interstate ? chargeableGst : Z,
    totalTax = chargeableGst.add(cess),
    grandTotal = round(
      i.taxMode === "INCLUSIVE" ? i.amount : taxable.add(totalTax),
    );
  return {
    taxable,
    cgst,
    sgst,
    igst,
    cess,
    totalTax,
    grandTotal,
    interstate,
    reverseCharge: !!i.reverseCharge,
    itcEligible: !!i.itcEligible && !composition,
  };
}
