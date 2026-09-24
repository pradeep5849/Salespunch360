"use client";
import {useActionState,useCallback,useEffect,useRef,useState} from "react";
import {saveLeadCall,type TelecallingActionState} from "@/app/actions/telecalling";

const RESULTS=[
 ["CONNECTED","Connected"],["NO_ANSWER","No Answer"],["BUSY","Busy"],["NOT_REACHABLE","Not Reachable"],["WRONG_NUMBER","Wrong Number"],
 ["CALL_BACK","Call Back"],["NOT_INTERESTED","Not Interested"],["INTERESTED","Interested"],["WANTS_VISIT","Wants Visit"],["WANTS_QUOTATION","Wants Quotation"],
] as const;

type DialSession={dialStartedAt:string;dialEndedAt:string;dialDurationSeconds:number};

function formatDuration(seconds:number){
 const minutes=Math.floor(seconds/60);
 const remainder=seconds%60;
 return minutes?`${minutes}m ${remainder}s`:`${remainder}s`;
}

export function CallResultForm({leadId,phone,compact=false,followUpTaskId,showDialer=true}:{leadId:string;phone:string|null;compact?:boolean;followUpTaskId?:string;showDialer?:boolean}){
 const [state,action,pending]=useActionState<TelecallingActionState,FormData>(saveLeadCall,{});
 const [result,setResult]=useState("CONNECTED");
 const [dialSession,setDialSession]=useState<DialSession|null>(null);
 const dialStartedMs=useRef<number|null>(null);
 const dialPageHidden=useRef(false);

 const finishDialSession=useCallback(()=>{
  const started=dialStartedMs.current;
  if(started===null||!dialPageHidden.current)return;
  const ended=Date.now();
  setDialSession({dialStartedAt:new Date(started).toISOString(),dialEndedAt:new Date(ended).toISOString(),dialDurationSeconds:Math.max(0,Math.round((ended-started)/1000))});
  dialStartedMs.current=null;
  dialPageHidden.current=false;
 },[]);

 const startDialSession=useCallback(()=>{
  dialStartedMs.current=Date.now();
  dialPageHidden.current=false;
  setDialSession(null);
 },[]);

 useEffect(()=>{
  const onVisibility=()=>{
   if(document.visibilityState==="hidden"){
    if(dialStartedMs.current!==null)dialPageHidden.current=true;
   }else finishDialSession();
  };
  const onPageHide=()=>{if(dialStartedMs.current!==null)dialPageHidden.current=true;};
  document.addEventListener("visibilitychange",onVisibility);
  window.addEventListener("pagehide",onPageHide);
  window.addEventListener("pageshow",finishDialSession);
  return()=>{
   document.removeEventListener("visibilitychange",onVisibility);
   window.removeEventListener("pagehide",onPageHide);
   window.removeEventListener("pageshow",finishDialSession);
  };
 },[finishDialSession]);

 return <div className={compact?"telecalling-call-form":"telecalling-call-form telecalling-call-form-full"}>
  {showDialer&&<div className="telecalling-actions">
   {phone?<a href={`tel:${phone}`} className="primary" onClick={startDialSession}>Call {phone}</a>:<span>No mobile number</span>}
   <small>{dialSession?`Dial session captured: ${formatDuration(dialSession.dialDurationSeconds)}. Save the call result below.`:"Save the result after the call. The PWA records dial-session time when you return from the phone app."}</small>
  </div>}
  <form action={action} className="telecalling-result-form">
   <input type="hidden" name="leadId" value={leadId}/>{followUpTaskId&&<input type="hidden" name="followUpTaskId" value={followUpTaskId}/>} 
   {dialSession?<><input type="hidden" name="dialStartedAt" value={dialSession.dialStartedAt}/><input type="hidden" name="dialEndedAt" value={dialSession.dialEndedAt}/><input type="hidden" name="timingSource" value="PWA_VISIBILITY"/></>:null}
   <label>Call result<select name="result" value={result} onChange={e=>setResult(e.target.value)}>{RESULTS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   {result==="CALL_BACK"?<label>Next callback<input required type="datetime-local" name="nextCallbackAt"/></label>:null}
   <label>Notes<textarea name="notes" rows={2} maxLength={2000} placeholder="What did the customer say?"/></label>
   <div className="telecalling-actions"><button disabled={pending||!phone} className="primary">{pending?"Saving…":"Save call result"}</button>{state.error?<span className="form-error">{state.error}</span>:null}{state.success?<span className="form-success">{state.success}</span>:null}</div>
  </form>
 </div>;
}
