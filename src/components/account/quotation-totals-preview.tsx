"use client";
import {calculateQuotation,type CalculationLine,type CalculationAdjustment} from "@/lib/quotations/calculation";
import {Money} from "./account-ui";

/** Read-only preview. Saving always recalculates through the authoritative service. */
export function QuotationTotalsPreview({lines,adjustments,canCost=false,roundOffEnabled=false}:{roundOffEnabled?:boolean;lines:CalculationLine[];adjustments:CalculationAdjustment[];canCost?:boolean}){
 let totals:ReturnType<typeof calculateQuotation>;
 try{totals=calculateQuotation(lines,adjustments,{roundOffEnabled})}catch{
  return <section aria-label="Quotation totals"><h2>Totals</h2><p role="status">Enter valid quantities, rates, discounts and tax percentages to preview totals.</p></section>;
 }
 const rows=[
  ["Subtotal",totals.subtotal],
  ["Discount",totals.discountTotal],
  ["Additional charges",totals.additionalChargeTotal],
  ["Taxable amount",totals.taxableTotal],
  ["Tax",totals.taxTotal],
  ["Round off",totals.roundOffAmount],
  ["Total amount",totals.grandTotal],
  ...(canCost?[["Internal cost",totals.internalCostTotal],["Expected profit",totals.expectedProfit]]:[]),
 ] as const;
 return <section aria-label="Quotation totals" aria-live="polite" aria-atomic="true"><h2>Totals</h2><p>Rates exclude tax. Totals are recalculated when you save.</p><dl>{rows.map(([label,amount])=><div key={String(label)}><dt>{String(label)}</dt><dd><Money value={amount}/></dd></div>)}</dl></section>;
}
