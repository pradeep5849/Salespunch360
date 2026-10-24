"use client";
import {useEffect,useRef,useState} from "react";
import type {ComponentProps} from "react";
import {NewAccountPartyForm} from "./new-party-form";
import {trapDialogFocus} from "./dialog-keyboard";
export function QuotationPartyDialog({onClose,...props}:ComponentProps<typeof NewAccountPartyForm>&{onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{const node=ref.current;node?.showModal();return()=>node?.close()},[]);
 const close=()=>{ref.current?.close();onClose()};
 return <dialog ref={ref} aria-labelledby="quotation-new-party-title" onKeyDown={trapDialogFocus} onCancel={event=>{event.preventDefault();if(!busy)close()}} style={{maxWidth:"min(42rem,calc(100vw - 2rem))",maxHeight:"85dvh",overflowY:"auto"}}>
  <h2 id="quotation-new-party-title">Add new party</h2>
  <NewAccountPartyForm {...props} onCreated={party=>{ref.current?.close();props.onCreated?.(party)}} onPendingChange={setBusy}/>
  <button type="button" onClick={close} disabled={busy}>Cancel adding party</button>
 </dialog>;
}
