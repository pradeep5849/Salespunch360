import { Prisma } from "@prisma/client";

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const ZERO = D(0);
const HUNDRED = D(100);
const MAX_MONEY = D("9999999999999999.99");
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export type ValueType = "PERCENTAGE" | "FIXED";
export type CalculationLine = { quantity: Prisma.Decimal.Value; rate: Prisma.Decimal.Value; internalUnitCost?: Prisma.Decimal.Value; taxRate?: Prisma.Decimal.Value; discountType?: ValueType | null; discountValue?: Prisma.Decimal.Value | null };
export type CalculationAdjustment = { type: "DISCOUNT" | "ADDITIONAL_CHARGE"; valueType: ValueType; value: Prisma.Decimal.Value; taxable?: boolean; taxRate?: Prisma.Decimal.Value };

function validatePercentage(value: Prisma.Decimal) {
  if (value.isNegative() || value.greaterThan(HUNDRED)) throw new Error("INVALID_PERCENTAGE");
}
function valueAmount(base: Prisma.Decimal, type: ValueType, raw: Prisma.Decimal.Value) {
  const value = D(raw);
  if (value.isNegative() || value.greaterThan(MAX_MONEY)) throw new Error("INVALID_ADJUSTMENT");
  if (type === "PERCENTAGE") validatePercentage(value);
  return money(type === "PERCENTAGE" ? base.mul(value).div(HUNDRED) : value);
}

/** Allocates a pre-tax document discount exactly, assigning the rounding remainder to the last non-zero line. */
function allocateDiscount(amount: Prisma.Decimal, bases: Prisma.Decimal[]) {
  const total = bases.reduce((sum, base) => sum.plus(base), ZERO);
  if (amount.greaterThan(total)) throw new Error("EXCESSIVE_DISCOUNT");
  let allocated = ZERO;
  const last = bases.reduce((found, base, index) => base.gt(0) ? index : found, -1);
  return bases.map((base, index) => {
    if (base.isZero()) return ZERO;
    const share = index === last ? money(amount.minus(allocated)) : money(amount.mul(base).div(total));
    allocated = money(allocated.plus(share));
    return share;
  });
}

export function calculateQuotation(lines: CalculationLine[], adjustments: CalculationAdjustment[] = []) {
  if (!lines.length) throw new Error("LINES_REQUIRED");
  const calculatedLines = lines.map(line => {
    const quantity = D(line.quantity), rate = D(line.rate), cost = D(line.internalUnitCost ?? 0), taxRate = D(line.taxRate ?? 0);
    if (quantity.lte(0) || rate.isNegative() || cost.isNegative()) throw new Error("INVALID_LINE_VALUE");
    validatePercentage(taxRate);
    const baseAmount = money(quantity.mul(rate));
    const discountAmount = line.discountType ? valueAmount(baseAmount, line.discountType, line.discountValue ?? 0) : ZERO;
    if (discountAmount.greaterThan(baseAmount)) throw new Error("EXCESSIVE_DISCOUNT");
    const taxableBeforeDocumentDiscount = money(baseAmount.minus(discountAmount));
    return { baseAmount, discountAmount, documentDiscountAmount: ZERO, taxableBeforeDocumentDiscount, taxableAmount: taxableBeforeDocumentDiscount, taxRate, taxAmount: ZERO, lineTotal: ZERO, internalCostTotal: money(quantity.mul(cost)) };
  });
  const sum = (values: Prisma.Decimal[]) => money(values.reduce((total, value) => total.plus(value), ZERO));
  const subtotal = sum(calculatedLines.map(line => line.baseAmount));
  let discountTotal = sum(calculatedLines.map(line => line.discountAmount));
  let remainingBase = sum(calculatedLines.map(line => line.taxableBeforeDocumentDiscount));
  let additionalChargeTotal = ZERO;
  let adjustmentTax = ZERO;
  const calculatedAdjustments = adjustments.map(adjustment => {
    const base = adjustment.type === "DISCOUNT" ? remainingBase : remainingBase.plus(additionalChargeTotal);
    const amount = valueAmount(base, adjustment.valueType, adjustment.value);
    if (adjustment.type === "DISCOUNT") {
      if (amount.greaterThan(remainingBase)) throw new Error("EXCESSIVE_DISCOUNT");
      const allocations = allocateDiscount(amount, calculatedLines.map(line => line.taxableAmount));
      calculatedLines.forEach((line, index) => { line.documentDiscountAmount = money(line.documentDiscountAmount.plus(allocations[index])); line.taxableAmount = money(line.taxableAmount.minus(allocations[index])); });
      discountTotal = money(discountTotal.plus(amount));
      remainingBase = money(remainingBase.minus(amount));
    } else {
      additionalChargeTotal = money(additionalChargeTotal.plus(amount));
    }
    const taxRate = D(adjustment.taxRate ?? 0); validatePercentage(taxRate);
    const taxAmount = adjustment.type === "ADDITIONAL_CHARGE" && adjustment.taxable ? money(amount.mul(taxRate).div(HUNDRED)) : ZERO;
    adjustmentTax = money(adjustmentTax.plus(taxAmount));
    return { ...adjustment, amount, taxAmount };
  });
  calculatedLines.forEach(line => { line.taxAmount = money(line.taxableAmount.mul(line.taxRate).div(HUNDRED)); line.lineTotal = money(line.taxableAmount.plus(line.taxAmount)); });
  const taxableTotal = money(remainingBase.plus(additionalChargeTotal));
  const taxTotal = money(sum(calculatedLines.map(line => line.taxAmount)).plus(adjustmentTax));
  const grandTotal = money(taxableTotal.plus(taxTotal));
  const internalCostTotal = sum(calculatedLines.map(line => line.internalCostTotal));
  const expectedProfit = money(taxableTotal.minus(internalCostTotal));
  const expectedMarginPercent = taxableTotal.isZero() ? ZERO : expectedProfit.mul(HUNDRED).div(taxableTotal).toDecimalPlaces(4);
  return { lines: calculatedLines, adjustments: calculatedAdjustments, subtotal, discountTotal, additionalChargeTotal, taxableTotal, taxTotal, grandTotal, internalCostTotal, expectedProfit, expectedMarginPercent };
}

/** A supplied schedule must use one mode and reconcile exactly; zero-total quotations may omit the schedule only. */
export function reconcilePaymentSchedule(rows: { valueType: ValueType; value: Prisma.Decimal.Value }[], grandTotal: Prisma.Decimal.Value) {
  if (!rows.length) return [];
  const total = money(D(grandTotal));
  if (total.lte(0)) throw new Error("ZERO_TOTAL_PAYMENT_SCHEDULE_NOT_ALLOWED");
  const mode = rows[0].valueType;
  if (rows.some(row => row.valueType !== mode)) throw new Error("MIXED_PAYMENT_SCHEDULE");
  const values = rows.map(row => { const value = D(row.value); if (value.isNegative()) throw new Error("INVALID_PAYMENT_SCHEDULE"); if (mode === "PERCENTAGE") validatePercentage(value); return value; });
  const valueTotal = values.reduce((sum, value) => sum.plus(value), ZERO);
  if ((mode === "PERCENTAGE" && !valueTotal.equals(HUNDRED)) || (mode === "FIXED" && !money(valueTotal).equals(total))) throw new Error("PAYMENT_SCHEDULE_MISMATCH");
  return values.map(value => money(mode === "PERCENTAGE" ? total.mul(value).div(HUNDRED) : value));
}
