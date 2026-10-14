"use client";
import {useEffect,useRef} from "react";
import { reverseOwnerTransactionAction } from "@/app/actions/money";
import { ActionFeedbackForm,AccountFieldError,useAccountFieldError } from "./action-feedback-form";
import { SavePendingFields,SaveSubmitButton } from "./save-feedback";
function CorrectionFields({transactionId,today}:{transactionId:string;today:string}){
 const dateError=useAccountFieldError("entryDate"),reasonError=useAccountFieldError("reason"),dateRef=useRef<HTMLInputElement>(null),reasonRef=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{if(dateError)dateRef.current?.focus();else if(reasonError)reasonRef.current?.focus()},[dateError,reasonError]);
 return <SavePendingFields><label>Correction date<input ref={dateRef} type="date" name="entryDate" defaultValue={today} required aria-invalid={!!dateError} aria-describedby={dateError?`owner-${transactionId}-date-error`:undefined}/></label><AccountFieldError name="entryDate" id={`owner-${transactionId}-date-error`}/><label>Reason<textarea ref={reasonRef} name="reason" minLength={3} maxLength={1000} required aria-invalid={!!reasonError} aria-describedby={reasonError?`owner-${transactionId}-reason-error`:undefined}/></label><AccountFieldError name="reason" id={`owner-${transactionId}-reason-error`}/></SavePendingFields>;
}
export function OwnerCorrectionForm({ownerId,transactionId,today,branchId}:{ownerId:string;transactionId:string;today:string;branchId?:string}){
 return <details><summary>Reverse this transaction</summary><p>A dated reversal restores its bank/cash and owner ledger effects. The original entry stays in history.</p><ActionFeedbackForm action={reverseOwnerTransactionAction}>
  {branchId&&<input type="hidden" name="branchId" value={branchId}/>}<input type="hidden" name="ownerId" value={ownerId}/><input type="hidden" name="transactionId" value={transactionId}/><CorrectionFields transactionId={transactionId} today={today}/><SaveSubmitButton>Post reversal</SaveSubmitButton>
 </ActionFeedbackForm></details>
}
