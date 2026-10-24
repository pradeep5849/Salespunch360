import {Prisma} from "@prisma/client";
import {commercialLineAmounts} from "./commercial-line-amounts";
import {calculateTax} from "./tax-calculation";
const D=Prisma.Decimal;
type PreviewLine={quantity:string;rate:string;discountType:string;discountValue:string;taxRate:string;cessRate?:string};
const decimal=(value:string|undefined)=>{try{const result=new D(value||0);return result.isFinite()?result:new D(0)}catch{return new D(0)}};
/** Incomplete editor values remain editable; only the server may authorize saving. */
function values(line:PreviewLine,mode:string){
 const qty=decimal(line.quantity),rate=decimal(line.rate),zero=new D(0);
 try{
  const price=commercialLineAmounts(qty,rate,line.discountType,decimal(line.discountType==="NONE"?"0":line.discountValue));
  const tax=calculateTax({amount:price.enteredAmount,taxRate:decimal(line.taxRate),cessRate:decimal(line.cessRate),taxMode:mode==="WITH"?"INCLUSIVE":"EXCLUSIVE"});
  return {qty,rate,base:price.baseAmount,disc:price.discountAmount,taxable:tax.taxable,tax:tax.totalTax,gstTax:tax.cgst.add(tax.sgst).add(tax.igst),cessTax:tax.cess,total:tax.grandTotal};
 }catch{return {qty,rate,base:zero,disc:zero,taxable:zero,tax:zero,gstTax:zero,cessTax:zero,total:zero}}
}
export function saleLineNumbers(line:PreviewLine,mode="WITHOUT"){
 const result=values(line,mode);return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,value.toNumber()])) as Record<keyof ReturnType<typeof values>,number>;
}
export function salePreviewTotals(lines:PreviewLine[],mode:string){
 const result={qty:new D(0),base:new D(0),discount:new D(0),tax:new D(0),taxable:new D(0),total:new D(0)};
 for(const line of lines){const row=values(line,mode);result.qty=result.qty.add(row.qty);result.base=result.base.add(row.base);result.discount=result.discount.add(row.disc);result.tax=result.tax.add(row.tax);result.taxable=result.taxable.add(row.taxable);result.total=result.total.add(row.total)}
 // Document totals follow the persisted sum of rounded taxable and tax amounts.
 result.total=result.taxable.add(result.tax);
 return Object.fromEntries(Object.entries(result).map(([key,value])=>[key,value.toNumber()])) as Record<keyof typeof result,number>;
}
