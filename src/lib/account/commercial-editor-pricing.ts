import { itemPriceForDocument } from "./item-pricing";
export type EditorPriceLine = {
 quantity:string;rate:string;discountType:string;discountValue:string;
 taxRate:string;cessRate?:string;
};
export type EditorPriceMaster = {
 salePrice?:string;sellingRate?:string;costPrice?:string;estimatedCost?:string;
 taxRate?:string|null;pricing?:unknown;
};
/** Omitted fields have the same master defaults as the server; typed overrides stay explicit. */
export function commercialEditorPricing(line:EditorPriceLine,master:EditorPriceMaster|undefined,purchase:boolean,taxMode:string,itemWiseDiscount=true):EditorPriceLine {
 const defaults=itemPriceForDocument(purchase?master?.costPrice??master?.estimatedCost:master?.salePrice??master?.sellingRate,master?.taxRate,master?.pricing,taxMode==="INCLUSIVE"?"INCLUSIVE":"EXCLUSIVE",purchase,line.quantity||"0");
 return {...line,rate:line.rate||defaults.rate.toString(),taxRate:line.taxRate===""?String(master?.taxRate??"0"):line.taxRate,discountType:line.discountType||(itemWiseDiscount?defaults.discountType:undefined)||"NONE",discountValue:line.discountType?line.discountValue:itemWiseDiscount?defaults.discountValue.toString():"0"};
}
