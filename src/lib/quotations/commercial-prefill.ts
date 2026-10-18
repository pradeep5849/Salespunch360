import {Prisma, type QuotationLineType} from "@prisma/client";
import {calculateQuotation, type CalculationAdjustment, type CalculationLine} from "./calculation";
import {commercialLineAmounts} from "@/lib/account/commercial-line-amounts";
import {calculateTax} from "@/lib/account/tax-calculation";

type SnapshotLine = CalculationLine & {
  lineType: QuotationLineType;
  productId?: string | null;
  serviceId?: string | null;
  workPackageId?: string | null;
  itemName: string;
  itemCode?: string | null;
  description?: string | null;
  specification?: string | null;
  unitName?: string | null;
  unitSymbol?: string | null;
};
type SnapshotAdjustment = CalculationAdjustment & {label: string};
export type QuotationCommercialLine = {
  lineType: QuotationLineType;
  sourceId?: string;
  itemName: string;
  itemCode?: string;
  description?: string;
  specification?: string;
  unitName?: string;
  unitSymbol?: string;
  quantity: string;
  rate: string;
  discountType: "FIXED";
  discountValue: string;
  taxRate: string;
};

/** Pure prefill only. Authorization, source linkage and posting belong to the caller.
 * Fold the original document discount into each line's fixed discount, preserving
 * the quotation calculator's exact allocation. Extra charges remain labelled lines.
 * No stock/payment identity, internal cost or original line identity is copied.
 */
export function quotationCommercialPrefill(lines: SnapshotLine[], adjustments: SnapshotAdjustment[] = []) {
  const calculated = calculateQuotation(lines, adjustments);
  const result: QuotationCommercialLine[] = lines.map((line, index) => {
    const amount = calculated.lines[index];
    const sourceId = line.lineType === "PRODUCT" ? line.productId
      : line.lineType === "SERVICE" ? line.serviceId
      : line.lineType === "WORK_PACKAGE" ? line.workPackageId : undefined;
    if (line.lineType !== "CUSTOM" && !sourceId) throw new Error("INVALID_QUOTATION_LINE_REFERENCE");
    return {
      lineType: line.lineType,
      ...(sourceId ? {sourceId} : {}),
      itemName: line.itemName,
      ...(line.itemCode ? {itemCode: line.itemCode} : {}),
      ...(line.description ? {description: line.description} : {}),
      ...(line.specification ? {specification: line.specification} : {}),
      ...(line.unitName ? {unitName: line.unitName} : {}),
      ...(line.unitSymbol ? {unitSymbol: line.unitSymbol} : {}),
      quantity: new Prisma.Decimal(line.quantity).toString(),
      rate: new Prisma.Decimal(line.rate).toFixed(2),
      discountType: "FIXED",
      discountValue: amount.discountAmount.add(amount.documentDiscountAmount).toFixed(2),
      taxRate: amount.taxRate.toString(),
    };
  });
  calculated.adjustments.forEach((adjustment, index) => {
    if (adjustment.type !== "ADDITIONAL_CHARGE" || adjustment.amount.isZero()) return;
    result.push({lineType: "CUSTOM", itemName: adjustments[index].label,
      quantity: "1", rate: adjustment.amount.toFixed(2), discountType: "FIXED",
      discountValue: "0", taxRate: adjustment.taxable ? new Prisma.Decimal(adjustment.taxRate ?? 0).toString() : "0"});
  });
  if (result.length > 500) throw new Error("CONVERSION_LINE_LIMIT_EXCEEDED");
  // The target calculator is independent. Refuse an unrepresentable snapshot
  // rather than silently changing its payable total during conversion.
  let taxable = new Prisma.Decimal(0), tax = new Prisma.Decimal(0);
  for (const line of result) {
    const price = commercialLineAmounts(new Prisma.Decimal(line.quantity), new Prisma.Decimal(line.rate), line.discountType, new Prisma.Decimal(line.discountValue));
    const amounts = calculateTax({amount: price.enteredAmount, taxRate: new Prisma.Decimal(line.taxRate), taxMode: "EXCLUSIVE"});
    taxable = taxable.add(amounts.taxable); tax = tax.add(amounts.totalTax);
  }
  if (!taxable.equals(calculated.taxableTotal) || !tax.equals(calculated.taxTotal)
    || !taxable.add(tax).equals(calculated.grandTotal)) throw new Error("CONVERSION_TOTAL_MISMATCH");
  return {taxMode: "EXCLUSIVE" as const, lines: result,
    taxableTotal: taxable.toFixed(2), taxTotal: tax.toFixed(2), grandTotal: calculated.grandTotal.toFixed(2)};
}
