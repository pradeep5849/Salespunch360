"use client";

import {useEffect,useState} from "react";
import {useFormStatus} from "react-dom";

type Feedback={status:"success"|"error";message:string}|null;
type SaveAction=(formData:FormData)=>Promise<unknown>;

type Props={
 action:SaveAction;
 children:React.ReactNode;
 className?:string;
 successMessage?:string;
 onChange?:React.FormEventHandler<HTMLFormElement>;
 onSuccess?:()=>void;
};

export function AccountSaveForm({action,children,className,successMessage="Saved successfully",onChange,onSuccess}:Props){
 const[saving,setSaving]=useState(false);
 const[feedback,setFeedback]=useState<Feedback>(null);
 useEffect(()=>{
  if(!feedback)return;
  const timer=window.setTimeout(()=>setFeedback(null),feedback.status==="success"?2600:6000);
  return()=>window.clearTimeout(timer);
 },[feedback]);
 async function submit(formData:FormData){
  if(saving)return;
  setSaving(true);
  setFeedback(null);
  try{
   await action(formData);
   setFeedback({status:"success",message:successMessage});
   onSuccess?.();
  }catch(error){
   const message=error instanceof Error&&error.message&&!/digest/i.test(error.message)?error.message:"Save failed. Please check the details and try again.";
   setFeedback({status:"error",message});
  }finally{
   setSaving(false);
  }
 }
 return <>
  <form action={submit} className={className} onChange={onChange} aria-busy={saving} data-saving={saving?"true":"false"}>{children}</form>
  {feedback&&<div className="account-save-toast" data-status={feedback.status} role={feedback.status==="error"?"alert":"status"} aria-live={feedback.status==="error"?"assertive":"polite"}>{feedback.message}</div>}
 </>;
}

export function AccountSubmitButton({children,className,savingText="Saving…"}:{children:React.ReactNode;className?:string;savingText?:string}){
 const{pending}=useFormStatus();
 return <button type="submit" className={className} disabled={pending} aria-disabled={pending}>{pending?savingText:children}</button>;
}
