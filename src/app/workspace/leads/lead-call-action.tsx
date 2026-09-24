"use client";

import {useEffect,useRef,useState} from "react";
import {CallResultForm,type DialSession} from "@/components/telecalling/call-result-form";

export function LeadCallAction({leadId,title,phone}:{leadId:string;title:string;phone:string}){
 const[open,setOpen]=useState(false);
 const[dialSession,setDialSession]=useState<DialSession|null>(null);
 const dialStartedMs=useRef<number|null>(null);
 const dialPageHidden=useRef(false);

 useEffect(()=>{
  const finish=()=>{
   const started=dialStartedMs.current;
   if(started===null||!dialPageHidden.current)return;
   const ended=Date.now();
   setDialSession({dialStartedAt:new Date(started).toISOString(),dialEndedAt:new Date(ended).toISOString(),dialDurationSeconds:Math.max(0,Math.round((ended-started)/1000))});
   dialStartedMs.current=null;
   dialPageHidden.current=false;
  };
  const onVisibility=()=>{
   if(document.visibilityState==="hidden"){
    if(dialStartedMs.current!==null)dialPageHidden.current=true;
   }else finish();
  };
  const onPageHide=()=>{if(dialStartedMs.current!==null)dialPageHidden.current=true;};
  document.addEventListener("visibilitychange",onVisibility);
  window.addEventListener("pagehide",onPageHide);
  window.addEventListener("pageshow",finish);
  return()=>{
   document.removeEventListener("visibilitychange",onVisibility);
   window.removeEventListener("pagehide",onPageHide);
   window.removeEventListener("pageshow",finish);
  };
 },[]);

 const startCall=()=>{
  dialStartedMs.current=Date.now();
  dialPageHidden.current=false;
  setDialSession(null);
  setOpen(true);
 };

 const close=()=>{
  setOpen(false);
  setDialSession(null);
  dialStartedMs.current=null;
  dialPageHidden.current=false;
 };

 return <>
  <a className="lead-call-button" href={`tel:${phone}`} aria-label={`Call ${title}`} onClick={startCall}>Call</a>
  {open&&<div className="lead-call-result-overlay" role="dialog" aria-modal="true" aria-labelledby={`call-result-${leadId}`} onClick={close}>
   <section className="lead-call-result-dialog" onClick={event=>event.stopPropagation()}>
    <div className="lead-call-result-header"><div><strong id={`call-result-${leadId}`}>Update call result</strong><small>{title} · {phone}</small></div><button type="button" onClick={close} aria-label="Close call result">×</button></div>
    <p>After the call, save the result, notes and next callback here.</p>
    <CallResultForm leadId={leadId} phone={phone} showDialer={false} capturedDialSession={dialSession}/>
   </section>
  </div>}
 </>;
}
