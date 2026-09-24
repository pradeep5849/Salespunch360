"use client";
import {useActionState,useState} from "react";
import {saveLeadCall,type TelecallingActionState} from "@/app/actions/telecalling";

const RESULTS=[
 ["CONNECTED","Connected"],["NO_ANSWER","No Answer"],["BUSY","Busy"],["NOT_REACHABLE","Not Reachable"],["WRONG_NUMBER","Wrong Number"],
 ["CALL_BACK","Call Back"],["NOT_INTERESTED","Not Interested"],["INTERESTED","Interested"],["WANTS_VISIT","Wants Visit"],["WANTS_QUOTATION","Wants Quotation"],
] as const;

export function CallResultForm({leadId,phone,compact=false,followUpTaskId}:{leadId:string;phone:string|null;compact?:boolean;followUpTaskId?:string}){
 const [state,action,pending]=useActionState<TelecallingActionState,FormData>(saveLeadCall,{});
 const [result,setResult]=useState("CONNECTED");
 return <div className={compact?"telecalling-call-form":"telecalling-call-form telecalling-call-form-full"}>
  <div className="telecalling-actions">
   {phone?<a href={`tel:${phone}`} className="primary">Call {phone}</a>:<span>No mobile number</span>}
   <small>Save the result after the call. Opening the dialer alone does not count.</small>
  </div>
  <form action={action} className="telecalling-result-form">
   <input type="hidden" name="leadId" value={leadId}/>{followUpTaskId&&<input type="hidden" name="followUpTaskId" value={followUpTaskId}/>} 
   <label>Call result<select name="result" value={result} onChange={e=>setResult(e.target.value)}>{RESULTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   {result==="CALL_BACK"?<label>Next callback<input required type="datetime-local" name="nextCallbackAt"/></label>:null}
   <label>Notes<textarea name="notes" rows={2} maxLength={2000} placeholder="What did the customer say?"/></label>
   <div className="telecalling-actions"><button disabled={pending||!phone} className="primary">{pending?"Saving…":"Save call result"}</button>{state.error?<span className="form-error">{state.error}</span>:null}{state.success?<span className="form-success">{state.success}</span>:null}</div>
  </form>
 </div>;
}
