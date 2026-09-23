"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";

const indiaToday=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

export function FollowUpForm({leadId,assignee}:{leadId:string;assignee:string}){
 const router=useRouter(),formRef=useRef<HTMLFormElement>(null),[pending,setPending]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function submit(form:FormData){
  setPending(true);setError("");setSuccess("");
  const type=String(form.get("type")||"VISIT"),dueDate=String(form.get("dueDate")||"");
  try{
   const res=await fetch("/api/workspace/follow-ups",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({leadId,dueDate,type,notes:form.get("notes")})}),data=await res.json();
   if(!res.ok||!data.ok)throw new Error();
   const today=indiaToday(),bucket=dueDate<today?"Overdue":dueDate===today?"Due Today":"Pending";
   setSuccess(`✓ ${type==="CALL"?"Call":"Visit"} follow-up added successfully. It is listed under ${bucket}.`);
   formRef.current?.reset();router.refresh();
  }catch{setError("Unable to add this follow-up. Check the date and your access.")}finally{setPending(false)}
 }
 return <form ref={formRef} id="add-follow-up" action={submit} className="lead-form follow-up-form">
  <input type="hidden" name="leadId" value={leadId}/><h2>+ Add Follow-up</h2><p>Assigned employee: <strong>{assignee}</strong></p>
  <label>Follow-up type<select name="type" defaultValue="VISIT" required><option value="VISIT">Visit</option><option value="CALL">Call</option></select></label>
  <label>Due date<input type="date" name="dueDate" required/></label>
  <label>Notes (optional)<textarea name="notes" maxLength={1900}/></label>
  <button disabled={pending}>{pending?"Adding…":"Add Follow-up"}</button>
  {error&&<p className="form-error" role="alert">{error}</p>}{success&&<p className="form-success" role="status">{success}</p>}
 </form>;
}
