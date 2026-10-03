"use client";
import {useEffect,useState} from "react";

export type SaveFeedbackState={success?:string;error?:string};

export function SaveFeedback({state}:{state:SaveFeedbackState}){
 const message=state.error??state.success;
 return message?<TransientFeedback key={`${state.error?"error":"success"}:${message}`} message={message} error={Boolean(state.error)}/>:null;
}

function TransientFeedback({message,error}:{message:string;error:boolean}){
 const[visible,setVisible]=useState(true);
 useEffect(()=>{if(error)return;const timer=window.setTimeout(()=>setVisible(false),2500);return()=>window.clearTimeout(timer)},[error]);
 if(!visible)return null;
 return <p className={error?"save-feedback error":"save-feedback"} role={error?"alert":"status"}>{message}</p>;
}
