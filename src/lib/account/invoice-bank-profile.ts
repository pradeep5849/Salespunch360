import {z} from "zod";
import {db} from "@/lib/db";
export type InvoiceBankProfile={bankDetails:string|null;upiId?:string;upiPayeeName?:string;showQr:boolean};
/** null preserves global legacy printing. An explicit inaccessible/inactive bank
 * fails closed and cannot fall back to a different account's instructions. */
export async function invoiceBankProfile(companyId:string,branchId:string,selected:unknown):Promise<InvoiceBankProfile|null>{
 if(selected===undefined||selected===null||selected==="")return null;
 const none={bankDetails:null,showQr:false};if(!z.string().guid().safeParse(selected).success)return none;
 const bank=await db.moneyAccount.findFirst({where:{id:String(selected),companyId,type:"BANK",isActive:true,OR:[{branchId:null},{branchId}]}});
 if(!bank)return none;
 return {bankDetails:bank.printBankDetails?[bank.bankName,bank.accountHolderName,bank.bankBranchName,bank.accountNumberMasked,bank.ifsc].filter(Boolean).join(" · ")||null:null,upiId:bank.printUpiQr?bank.upiId??undefined:undefined,upiPayeeName:bank.accountHolderName??bank.name,showQr:bank.printUpiQr};
}
