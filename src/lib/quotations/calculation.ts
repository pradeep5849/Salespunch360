import { Prisma } from "@prisma/client";

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const ZERO = D(0), HUNDRED = D(100);
const money = (value: Prisma.Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export type ValueType = "PERCENTAGE" | "FIXED";
export type CalculationLine = { quantity: Prisma.Decimal.Value; rate: Prisma.Decimal.Value; internalUnitCost?: Prisma.Decimal.Value; taxRate?: Prisma.Decimal.Value; discountType?: ValueType | null; discountValue?: Prisma.Decimal.Value | null };
export type CalculationAdjustment = { type: "DISCOUNT" | "ADDITIONAL_CHARGE"; valueType: ValueType; value: Prisma.Decimal.Value; taxable?: boolean; taxRate?: Prisma.Decimal.Value };

function validRate(value: Prisma.Decimal, max?: Prisma.Decimal) {
  if (value.isNegative() || (max && value.greaterThan(max))) throw new Error("INVALID_PERCENTAGE");
}
function adjustmentAmount(base: Prisma.Decimal, kind: ValueType, raw: Prisma.Decimal.Value) {
  const value = D(raw); validRate(value, kind === "PERCENTAGE" ? HUNDRED : undefined);
  const amount = kind === "PERCENTAGE" ? base.mul(value).div(HUNDRED) : value;
  if (amount.greaterThan(base)) throw new Error("EXCESSIVE_DISCOUNT");
  return money(amount);
}
export function calculateQuotation(lines: CalculationLine[], adjustments: CalculationAdjustment[] = []) {
  if (!lines.length) throw new Error("LINES_REQUIRED");
  const calculatedLines = lines.map(line => {
    const quantity=D(line.quantity),rate=D(line.rate),cost=D(line.internalUnitCost??0),taxRate=D(line.taxRate??0);
    if (quantity.lte(0)||rate.isNegative()||cost.isNegative()) throw new Error("INVALID_LINE_VALUE"); validRate(taxRate,HUNDRED);
    const baseAmount=money(quantity.mul(rate));
    const discountAmount=line.discountType?adjustmentAmount(baseAmount,line.discountType,line.discountValue??0):ZERO;
    const taxableAmount=money(baseAmount.minus(discountAmount));
    const taxAmount=money(taxableAmount.mul(taxRate).div(HUNDRED));
    const internalCostTotal=money(quantity.mul(cost));
    return {baseAmount,discountAmount,taxableAmount,taxRate,taxAmount,lineTotal:money(taxableAmount.plus(taxAmount)),internalCostTotal};
  });
  const sum=(values:Prisma.Decimal[])=>money(values.reduce((a,v)=>a.plus(v),ZERO));
  const subtotal=sum(calculatedLines.map(x=>x.baseAmount));
  let discountTotal=sum(calculatedLines.map(x=>x.discountAmount));
  let additionalChargeTotal=ZERO,adjustmentTax=ZERO;
  const calculatedAdjustments=adjustments.map(a=>{
    const base=a.type==="DISCOUNT"?subtotal.minus(discountTotal):subtotal.minus(discountTotal).plus(additionalChargeTotal);
    const amount=adjustmentAmount(base,a.valueType,a.value);
    if(a.type==="DISCOUNT") discountTotal=money(discountTotal.plus(amount)); else additionalChargeTotal=money(additionalChargeTotal.plus(amount));
    const taxRate=D(a.taxRate??0); validRate(taxRate,HUNDRED);
    const taxAmount=a.taxable&&a.type==="ADDITIONAL_CHARGE"?money(amount.mul(taxRate).div(HUNDRED)):ZERO;
    adjustmentTax=money(adjustmentTax.plus(taxAmount)); return {...a,amount,taxAmount};
  });
  const taxableTotal=money(subtotal.minus(discountTotal).plus(additionalChargeTotal));
  if(taxableTotal.isNegative())throw new Error("NEGATIVE_TOTAL");
  const taxTotal=money(sum(calculatedLines.map(x=>x.taxAmount)).plus(adjustmentTax));
  const grandTotal=money(taxableTotal.plus(taxTotal));
  const internalCostTotal=sum(calculatedLines.map(x=>x.internalCostTotal));
  const expectedProfit=money(taxableTotal.minus(internalCostTotal));
  const expectedMarginPercent=taxableTotal.isZero()?ZERO:expectedProfit.mul(HUNDRED).div(taxableTotal).toDecimalPlaces(4);
  return {lines:calculatedLines,adjustments:calculatedAdjustments,subtotal,discountTotal,additionalChargeTotal,taxableTotal,taxTotal,grandTotal,internalCostTotal,expectedProfit,expectedMarginPercent};
}

export function reconcilePaymentSchedule(rows:{valueType:ValueType;value:Prisma.Decimal.Value}[],grandTotal:Prisma.Decimal.Value){
 if(!rows.length)return [];
 const total=D(grandTotal);let percentages=ZERO,amounts=ZERO;
 const result=rows.map(row=>{const value=D(row.value);if(value.isNegative())throw new Error("INVALID_PAYMENT_SCHEDULE");if(row.valueType==="PERCENTAGE"){validRate(value,HUNDRED);percentages=percentages.plus(value);return money(total.mul(value).div(HUNDRED));}amounts=amounts.plus(value);return money(value);});
 if(!percentages.isZero()&&!amounts.isZero())throw new Error("MIXED_PAYMENT_SCHEDULE");
 if((!percentages.isZero()&&!percentages.equals(HUNDRED))||(!amounts.isZero()&&!money(amounts).equals(money(total))))throw new Error("PAYMENT_SCHEDULE_MISMATCH");
 return result;
}
