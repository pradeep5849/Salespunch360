"use client";

import {useState} from "react";
import {CallResultForm} from "@/components/telecalling/call-result-form";

export function LeadCallAction({leadId,title,phone}:{leadId:string;title:string;phone:string}){
 const[open,setOpen]=useState(false);
 return <>
  <a className="lead-call-button" href={`tel:${phone}`} aria-label={`Call ${title}`} onClick={()=>setOpen(true)}>Call</a>
  {open&&<div className="lead-call-result-overlay" role="dialog" aria-modal="true" aria-labelledby={`call-result-${leadId}`} onClick={()=>setOpen(false)}>
   <section className="lead-call-result-dialog" onClick={event=>event.stopPropagation()}>
    <div className="lead-call-result-header"><div><strong id={`call-result-${leadId}`}>Update call result</strong><small>{title} · {phone}</small></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close call result">×</button></div>
    <p>After the call, save the result, notes and next callback here.</p>
    <CallResultForm leadId={leadId} phone={phone} showDialer={false}/>
   </section>
  </div>}
 </>;
}
