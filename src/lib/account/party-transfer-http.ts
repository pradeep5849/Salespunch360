import {z} from "zod";
import {AuthenticationError,AuthorizationError} from "@/lib/auth/authorization";
import {boundedPrivateDocumentMultipart} from "./private-document-multipart";
import {accountErrorMessage} from "./action-feedback";
import type {partyTransferForActor} from "./party-transfers";

export const partyTransferJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Vary":"Authorization, Cookie"}});
/** Deliberate allow-list: private keys, hashes and journal identifiers never leave the service. */
export function partyTransferDto(row:Omit<Awaited<ReturnType<typeof partyTransferForActor>>,"status">&{status?:"POSTED"|"REVERSED"}){
 return{id:row.id,status:row.status??"POSTED",number:row.number,branchId:row.branchId,moneyAccountId:row.moneyAccountId,transactionDate:row.transactionDate,receivedParty:row.receivedParty,paidParty:row.paidParty,receivedPartyName:row.receivedPartyName,paidPartyName:row.paidPartyName,receivedAmount:row.receivedAmount,paidAmount:row.paidAmount,passThroughAmount:row.passThroughAmount,commissionAmount:row.commissionAmount,commissionHead:row.commissionHead,expenseAmount:row.expenseAmount,notes:row.notes,hasPhoto:Boolean(row.photoObjectKey),commissionIncomeId:row.commissionIncomeId,createdAt:row.createdAt.toISOString()};
}
export async function partyTransferForm(request:Request){
 const invalid=()=>new Error("INVALID_PARTY_TRANSFER_FORM"),form=await boundedPrivateDocumentMultipart(request,invalid);
 if([...form.keys()].some(key=>key!=="document"&&key!=="photo")||form.getAll("document").length!==1||form.getAll("photo").length>1)throw invalid();
 const document=form.get("document"),photo=form.get("photo");
 if(typeof document!=="string"||document.length>20000||(photo!==null&&!(photo instanceof File)))throw invalid();
 let input:unknown;try{input=JSON.parse(document)}catch{throw invalid()}
 return{input,file:photo instanceof File?photo:undefined};
}
export function partyTransferFailure(error:unknown){
 const code=error instanceof Error?error.message:"";
 if(error instanceof AuthenticationError||code==="MOBILE_UNAUTHORIZED")return partyTransferJson({error:"UNAUTHORIZED"},401);
 if(error instanceof AuthorizationError||["MOBILE_FORBIDDEN","UNTRUSTED_ORIGIN","SUBSCRIPTION_REQUIRED"].includes(code)||code.startsWith("MODULE_DISABLED:"))return partyTransferJson({error:"FORBIDDEN"},403);
 if(code==="RATE_LIMITED")return partyTransferJson({error:code},429);
 if(["PARTY_TRANSFER_NOT_FOUND","PARTY_TRANSFER_PHOTO_NOT_FOUND"].includes(code))return partyTransferJson({error:"NOT_FOUND"},404);
 if(code==="PARTY_TRANSFER_ALREADY_REVERSED")return partyTransferJson({error:code,message:"This transfer has already been reversed. Reload its saved history."},409);
 if(error instanceof SyntaxError)return partyTransferJson({error:"INVALID_INPUT"},400);
 if(code==="IDEMPOTENCY_KEY_REUSED")return partyTransferJson({error:code,message:"This request reference already belongs to different transfer details. Review the saved transfer before retrying."},409);
 if(error instanceof z.ZodError||["INVALID_PARTY_TRANSFER_FORM","INVALID_PARTY_TRANSFER_PHOTO","INVALID_PARTY_TRANSFER_PARTY","INVALID_MONEY_ACCOUNT","INVALID_FINANCIAL_YEAR","PERIOD_LOCKED","INVALID_PARTY_TRANSFER_CLEARING","INVALID_TRANSFER_COMMISSION_CATEGORY"].includes(code))return partyTransferJson({error:error instanceof z.ZodError?"INVALID_INPUT":code,message:code==="INVALID_PARTY_TRANSFER_FORM"||error instanceof z.ZodError?"Check the transfer details and try again.":accountErrorMessage(error)},400);
 return partyTransferJson({error:"TRANSFER_UNAVAILABLE",message:"The transfer could not be saved or retrieved. Retry with the same request reference."},503);
}
export function partyTransferPhotoResponse(photo:{bytes:Buffer;mimeType:"image/webp"}){return new Response(new Uint8Array(photo.bytes),{headers:{"Content-Type":photo.mimeType,"Content-Disposition":"inline; filename=party-transfer.webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Vary":"Authorization, Cookie"}})}
