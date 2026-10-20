import { itemPriceForSelectedUnit } from "./item-pricing";
export type EditorPriceLine = {
 unitSelection?:"PRIMARY"|"SECONDARY";unitConversionSnapshot?:{selection:"PRIMARY"|"SECONDARY";secondaryUnitsPerBase:string};quantity:string;rate:string;discountType:string;discountValue:string;
 taxRate:string;cessRate?:string;
};
export type EditorPriceMaster = {
 secondaryUnitsPerBase?:string|null;salePrice?:string;sellingRate?:string;costPrice?:string;estimatedCost?:string;
 taxRate?:string|null;pricing?:unknown;
};
/** Omitted fields have the same master defaults as the server; typed overrides stay explicit. */
export function commercialEditorPricing(line:EditorPriceLine,master:EditorPriceMaster|undefined,purchase:boolean,taxMode:string,itemWiseDiscount=true):EditorPriceLine {
 const defaults=itemPriceForSelectedUnit({rate:purchase?master?.costPrice??master?.estimatedCost:master?.salePrice??master?.sellingRate,taxRate:master?.taxRate,pricing:master?.pricing,mode:taxMode==="INCLUSIVE"?"INCLUSIVE":"EXCLUSIVE",purchase,quantity:line.quantity||"0",selection:line.unitSelection??line.unitConversionSnapshot?.selection??"PRIMARY",secondaryUnitsPerBase:line.unitConversionSnapshot?.secondaryUnitsPerBase??master?.secondaryUnitsPerBase??undefined});
 return {...line,rate:line.rate||defaults.rate.toString(),taxRate:line.taxRate===""?String(master?.taxRate??"0"):line.taxRate,discountType:line.discountType||(itemWiseDiscount?defaults.discountType:undefined)||"NONE",discountValue:line.discountType?line.discountValue:itemWiseDiscount?defaults.discountValue.toString():"0"};
}
