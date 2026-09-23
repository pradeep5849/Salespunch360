"use client";
import {useActionState,useState} from "react";
import {saveLeadCall,type TelecallingActionState} from "@/app/actions/telecalling";

const RESULTS=[
 ["CONNECTED","Connected"],["NO_ANSWER","No Answer"],["BUSY","Busy"],["NOT_REACHABLE","Not Reachable"],["WRONG_NUMBER","Wrong Number"],
 ["CALL_BACK","Call Back"],["NOT_INTERESTED","Not Interested"],["INTERESTED","Interested"],["WANTS_VISIT","Wants Visit"],["WANTS_QUOTATION","Wants Quotation"],
] as const;

export function CallResultForm({leadId,phone,compact=false}:{leadId:string;phone:string|null;compact?:boolean}){
 const [state,action,pending]=useActionState<TelecallingActionState,FormData>(saveLeadCall,{});
 const [result,setResult]=useState("CONNECTED");
 return <div className={compact?"space-y-2":"space-y-3 rounded-xl border p-4"}>
  <div className="flex flex-wrap items-center gap-2">
   {phone?<a href={`tel:${phone}`} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Call {phone}</a>:<span className="text-sm text-slate-500">No mobile number</span>}
   <span className="text-xs text-slate-500">Save the result after the call. Opening the dialer alone does not count.</span>
  </div>
  <form action={action} className="grid gap-2 md:grid-cols-2">
   <input type="hidden" name="leadId" value={leadId}/>
   <label className="text-sm">Call result
    <select name="result" value={result} onChange={e=>setResult(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
     {RESULTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select>
   </label>
   {result==="CALL_BACK"?<label className="text-sm">Next callback
    <input required type="datetime-local" name="nextCallbackAt" className="mt-1 w-full rounded-lg border px-3 py-2"/>
   </label>:<div/>}
   <label className="text-sm md:col-span-2">Notes
    <textarea name="notes" rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="What did the customer say?"/>
   </label>
   <div className="md:col-span-2 flex items-center gap-3">
    <button disabled={pending||!phone} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending?"Saving…":"Save call result"}</button>
    {state.error?<span className="text-sm text-red-600">{state.error}</span>:null}
    {state.success?<span className="text-sm text-emerald-700">{state.success}</span>:null}
   </div>
  </form>
 </div>;
}
