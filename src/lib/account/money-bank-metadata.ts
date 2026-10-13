import {z} from "zod";
const blank=(v:unknown)=>v===""?undefined:v;
const flag=z.preprocess(v=>v==="on"||v==="true"?true:v==="false"?false:v,z.boolean().default(false));
export const moneyBankMetadata=z.object({
 accountHolderName:z.preprocess(blank,z.string().trim().max(160).optional()),
 bankBranchName:z.preprocess(blank,z.string().trim().max(160).optional()),
 upiId:z.preprocess(blank,z.string().trim().regex(/^[\w.\-]{2,256}@[A-Za-z]{2,64}$/, "Enter a valid UPI ID.").optional()),
 printBankDetails:flag,
 printUpiQr:flag,
});
export const bankIfsc=z.preprocess(blank,z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i,"IFSC must contain four bank letters, 0 and six branch characters.").optional());
export function hasBankMetadata(data:Record<string,unknown>){return Boolean(data.accountHolderName||data.bankBranchName||data.upiId||data.printBankDetails||data.printUpiQr);}
