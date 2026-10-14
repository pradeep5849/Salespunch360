import { z } from "zod";
export const PRINT_BOOLS = ["regularDefault","repeatHeader","printCompanyName","companyLogo","address","email","phone","gstinOnSale","billOfSupply","originalDuplicate","expandTable","totalItemQuantity","amountDecimal","receivedAmount","balanceAmount","partyCurrentBalance","taxDetails","amountGrouping","youSaved","printDescription","termsEnabled","receivedBy","deliveredBy","signatureText","paymentMode","acknowledgement","pageNumbers"] as const;
export const PRINT_STRINGS = ["printer","theme","printTextSize","pageSize","orientation","companyNameTextSize","amountWordsFormat","termsText","customSignatureText","transactionName","itemTableColumns","bankAccountId"] as const;
export const invoicePrintSettingsSchema = z.object({
  ...Object.fromEntries(PRINT_BOOLS.map(key=>[key,z.boolean().optional()])),
  ...Object.fromEntries(PRINT_STRINGS.map(key=>[key,z.string().max(key==="termsText"?10000:500).optional()])),
  theme:z.string().trim().regex(/^(REGULAR|MODERN|CLASSIC|MINIMAL|#[0-9a-f]{6})$/i,"Choose Regular, Modern, Classic, Minimal, or a six-digit hex color.").optional(),
  itemTableColumns:z.string().trim().max(500).refine(value=>value.split(",").every(column=>["ITEM","QTY","RATE","TAXABLE","TAX","AMOUNT"].includes(column.trim().toUpperCase())),"Use comma-separated ITEM, QTY, RATE, TAXABLE, TAX, AMOUNT columns.").optional(),
  bankAccountId:z.union([z.literal(""),z.string().uuid()]).optional(),
  printer:z.enum(["REGULAR","THERMAL"]).optional(),
  pageSize:z.enum(["A4","A5","THERMAL_80MM"]).optional(),
  orientation:z.enum(["PORTRAIT","LANDSCAPE"]).optional(),
  printTextSize:z.enum(["SMALL","MEDIUM","LARGE"]).optional(),
  companyNameTextSize:z.enum(["SMALL","MEDIUM","LARGE"]).optional(),
  amountWordsFormat:z.enum(["INDIAN","INTERNATIONAL"]).optional(),
  topSpace:z.number().int().min(0).max(20).optional(),
  minRows:z.number().int().min(0).max(50).optional(),
}).strict();
export function printSettingsFromForm(fd:FormData) {
  return invoicePrintSettingsSchema.parse({
    ...Object.fromEntries(PRINT_BOOLS.map(key=>[key,fd.get(key)==="on"])),
    ...Object.fromEntries(PRINT_STRINGS.filter(key=>fd.has(key)).map(key=>[key,String(fd.get(key)??"")])),
    topSpace:Number(fd.get("topSpace")??0),minRows:Number(fd.get("minRows")??0),
  });
}
