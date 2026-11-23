"use client";
import {useState} from "react";
import {SaveFeedbackForm} from "./save-feedback";
export function StockMovementForm({action,initialRequestKey,children}:{action:(data:FormData)=>Promise<unknown>;initialRequestKey:string;children:React.ReactNode}){
 const [requestKey,setRequestKey]=useState(initialRequestKey);
 return <SaveFeedbackForm action={action} className="stack" successMessage="Stock movement confirmed by the server." onSuccess={()=>setRequestKey(crypto.randomUUID())} errorMessages={{IDEMPOTENCY_CONFLICT:"This request was already saved with different details. Refresh and review the saved movement before starting a new one.",INSUFFICIENT_STOCK:"The source warehouse has insufficient stock."}}><input type="hidden" name="requestKey" value={requestKey}/>{children}</SaveFeedbackForm>;
}
