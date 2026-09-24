"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";

const indiaToday=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
type TelecallerOption={id:string;name:string};

export function FollowUpForm({leadId,assignee,telecallers=[]}:{leadId:string;assignee:string;telecallers?:TelecallerOption[]}){
 const router=useRouter(),formRef=useRef<HTMLFormElement>(null),[pending,setPending]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState(""),[type,setType]=useState("VISIT"),[assignment,setAssignment]=useState("SELF"),[telecallerId,setTelecallerId]=useState(telecallers[0]?.id||"");
 async function submit(form:FormData){
  setPending(true);setError("");setSuccess("");
  const dueDate=String(form.get("dueDate")||"");
  const assignedUserId=type==="CALL"&&assignment==="TELECALLER"?telecallerId:undefined;
  try{
   if(type==="CALL"&&assignment==="TELECALLER"&&!assignedUserId)throw new Error("NO_TELECALLER");
   const res=await fetch("/api/workspace/follow-ups",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({leadId,dueDate,type,notes:form.get("notes"),assignedUserId})}),data=await res.json();
   if(!res.ok||!data.ok)throw new Error(String(data.error||"FAILED"));
   const today=indiaToday(),bucket=dueDate<today?"Overdue":dueDate===today?"Due Today":"Pending";
   const target=assignedUserId?telecallers.find(x=>x.id===assignedUserId)?.name:assignee;
   setSuccess(`✓ ${type==="CALL"?"Call":"Visit"} follow-up added for ${target||assignee}. It is listed under ${bucket}.`);
   formRef.current?.reset();setType("VISIT");setAssignment("SELF");router.refresh();
  }catch(e){setError(e instanceof Error&&e.message==="NO_TELECALLER"?"Choose an active Telecaller.":"Unable to add this follow-up. Check the date, Telecaller seat and your access.")}finally{setPending(false)}
 }
 return <form ref={formRef} id="add-follow-up" action={submit} className="lead-form follow-up-form">
  <input type="hidden" name="leadId" value={leadId}/><h2>+ Add Follow-up</h2><p>Lead owner: <strong>{assignee}</strong></p>
  <label>Follow-up type<select name="type" value={type} onChange={e=>{setType(e.target.value);if(e.target.value!=="CALL")setAssignment("SELF");}} required><option value="VISIT">Visit</option><option value="CALL">Call</option></select></label>
  {type==="CALL"&&<fieldset className="follow-up-assignment"><legend>Assign call to</legend><label><input type="radio" name="assignment" value="SELF" checked={assignment==="SELF"} onChange={()=>setAssignment("SELF")}/> Myself / lead owner</label><label><input type="radio" name="assignment" value="TELECALLER" checked={assignment==="TELECALLER"} onChange={()=>setAssignment("TELECALLER")} disabled={!telecallers.length}/> Telecaller</label>{assignment==="TELECALLER"&&<select aria-label="Telecaller" value={telecallerId} onChange={e=>setTelecallerId(e.target.value)} required><option value="">Choose Telecaller</option>{telecallers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}{!telecallers.length&&<small>No active paid Telecaller is available.</small>}</fieldset>}
  <label>Due date<input type="date" name="dueDate" required/></label>
  <label>Notes (optional)<textarea name="notes" maxLength={1900}/></label>
  <button disabled={pending}>{pending?"Adding…":"Add Follow-up"}</button>
  {error&&<p className="form-error" role="alert">{error}</p>}{success&&<p className="form-success" role="status">{success}</p>}
 </form>;
}
