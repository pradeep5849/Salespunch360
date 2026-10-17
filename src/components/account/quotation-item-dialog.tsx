"use client";
import {useEffect,useRef,useState} from "react";
import {getQuotationItemCreationOptionsAction} from "@/app/actions/quotations";
import {AddItemEditor} from "@/app/workspace/account/inventory/items/new/add-item-editor";
import {trapDialogFocus} from "./dialog-keyboard";
export function QuotationItemDialog({kind,onClose,onCreated}:{kind:"products"|"services";onClose:()=>void;onCreated:(item:{id:string;kind:"products"|"services"})=>Promise<void>}){
 const dialog=useRef<HTMLDialogElement>(null),[options,setOptions]=useState<Awaited<ReturnType<typeof getQuotationItemCreationOptionsAction>>>(),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const node=dialog.current,previous=document.activeElement;node?.showModal();return()=>{node?.close();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus()}},[]);
 useEffect(()=>{let active=true;void getQuotationItemCreationOptionsAction().then(value=>{if(active){setOptions(value);setFailed(false)}}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[attempt]);
 const close=()=>{dialog.current?.close();onClose()};
 return <dialog ref={dialog} aria-label="Add quotation item" onKeyDown={trapDialogFocus} onCancel={event=>event.preventDefault()} style={{margin:0,border:0,padding:0,width:"100vw",height:"100dvh",maxWidth:"none",maxHeight:"none",borderRadius:0,overflowY:"auto"}}>
 {options?<AddItemEditor {...options} initialKind={kind} onCancel={close} onCreated={onCreated}/>:<section><p role={failed?"alert":"status"}>{failed?"Unable to load item form. Your quotation is retained.":"Loading item form…"}</p>{failed&&<button type="button" onClick={()=>{setFailed(false);setAttempt(value=>value+1)}}>Retry item form</button>}<button type="button" onClick={close}>Cancel adding item</button></section>}
 </dialog>;
}
