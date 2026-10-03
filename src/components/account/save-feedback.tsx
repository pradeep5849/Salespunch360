"use client";
import {useCallback,useEffect,useState,type FormEvent,type ReactNode} from "react";

export type SaveFeedbackState={kind:"success"|"error";text:string}|null;

export function useAccountSaveFeedback(){
 const[saving,setSaving]=useState(false),[feedback,setFeedback]=useState<SaveFeedbackState>(null);
 useEffect(()=>{if(!feedback)return;const timer=window.setTimeout(()=>setFeedback(null),feedback.kind==="success"?2500:5000);return()=>window.clearTimeout(timer)},[feedback]);
 const run=useCallback(async(action:()=>Promise<unknown>,successText="Saved successfully")=>{if(saving)return false;setSaving(true);setFeedback(null);try{await action();setFeedback({kind:"success",text:successText});return true}catch(error){setFeedback({kind:"error",text:error instanceof Error&&error.message?error.message:"Save failed. Please try again."});return false}finally{setSaving(false)}},[saving]);
 return{saving,feedback,run,setFeedback};
}

export function AccountSaveFeedback({feedback}:{feedback:SaveFeedbackState}){if(!feedback)return null;return <div role={feedback.kind==="error"?"alert":"status"} aria-live="polite" style={{position:"fixed",zIndex:180,left:"50%",bottom:24,transform:"translateX(-50%)",maxWidth:"calc(100% - 32px)",padding:"10px 16px",borderRadius:8,background:feedback.kind==="success"?"#166534":"#b91c1c",color:"#fff",fontSize:14,fontWeight:600,boxShadow:"0 8px 24px #0003",whiteSpace:"normal",textAlign:"center"}}>{feedback.text}</div>}

export function AccountSaveForm({action,className,children,successText="Saved successfully"}:{action:(data:FormData)=>Promise<unknown>;className?:string;children:ReactNode;successText?:string}){
 const{saving,feedback,run}=useAccountSaveFeedback();
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const submitters=Array.from(form.querySelectorAll<HTMLButtonElement>('button[type="submit"],button:not([type])'));const disabled=submitters.map(button=>button.disabled);submitters.forEach(button=>button.disabled=true);await run(()=>action(new FormData(form)),successText);submitters.forEach((button,index)=>button.disabled=disabled[index])}
 return <><form className={className} onSubmit={submit} aria-busy={saving}>{children}</form><AccountSaveFeedback feedback={feedback}/></>;
}
