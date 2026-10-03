"use client";

import {useActionState,useCallback,useEffect,useRef,useState} from "react";
import {useFormStatus} from "react-dom";

export type SaveFeedbackState={kind:"idle"|"success"|"error";message:string;id:number};
export const INITIAL_SAVE_FEEDBACK:SaveFeedbackState={kind:"idle",message:"",id:0};
export const SAVE_FEEDBACK_DISMISS_MS=2500;

export async function executeSave(action:(data:FormData)=>Promise<unknown>,data:FormData,id=Date.now()):Promise<SaveFeedbackState>{
 try{await action(data);return{kind:"success",message:"Saved successfully",id}}
 catch{return{kind:"error",message:"Unable to save. Check the details and try again.",id}}
}

export function SaveFeedbackForm({action,className,children,successMessage="Saved successfully",onSuccess}:{action:(data:FormData)=>Promise<unknown>;className?:string;children:React.ReactNode;successMessage?:string;onSuccess?:()=>void}){
 const[state,formAction]=useActionState(async(previous:SaveFeedbackState,data:FormData)=>{const next=await executeSave(action,data,previous.id+1);return next.kind==="success"?{...next,message:successMessage}:next},INITIAL_SAVE_FEEDBACK);
 useEffect(()=>{if(state.kind==="success")onSuccess?.()},[state.kind,state.id,onSuccess]);
 return <form action={formAction} className={className}><SaveFeedback state={state}/>{children}</form>;
}

export function SaveSubmitButton({children,pendingLabel="Saving…",className}:{children:React.ReactNode;pendingLabel?:string;className?:string}){const{pending}=useFormStatus();return <button type="submit" className={className} disabled={pending} aria-disabled={pending}>{pending?pendingLabel:children}</button>}

export function SaveFeedback({state}:{state:SaveFeedbackState}){
 const[dismissedId,setDismissedId]=useState(0);
 useEffect(()=>{if(state.kind!=="success")return;const timer=window.setTimeout(()=>setDismissedId(state.id),SAVE_FEEDBACK_DISMISS_MS);return()=>window.clearTimeout(timer)},[state.kind,state.id]);
 const visible=state.kind!=="idle"&&state.id!==dismissedId;
 if(!visible)return null;
 return <p className={`account-save-feedback ${state.kind}`} role={state.kind==="error"?"alert":"status"}>{state.message}</p>
}

export function useSaveMutation(){const[pending,setPending]=useState(false),[feedback,setFeedback]=useState(INITIAL_SAVE_FEEDBACK),active=useRef(false);const run=useCallback(async(action:()=>Promise<unknown>,successMessage="Saved successfully")=>{if(active.current)return false;active.current=true;setPending(true);setFeedback(INITIAL_SAVE_FEEDBACK);try{await action();setFeedback({kind:"success",message:successMessage,id:Date.now()});return true}catch{setFeedback({kind:"error",message:"Unable to save. Check the details and try again.",id:Date.now()});return false}finally{active.current=false;setPending(false)}},[]);return{pending,feedback,run}}
