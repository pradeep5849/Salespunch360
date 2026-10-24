"use client";
import {useState} from "react";
export function ManualMessage({message,phone}:{message:string;phone?:string|null}){
 const [status,setStatus]=useState("");
 const digits=(phone??"").replace(/[^0-9+]/g,"");
 return <div><details><summary>Prepare message</summary><textarea aria-label="Prepared message" readOnly value={message} rows={5}/><div className="account-actions"><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(message);setStatus("Message copied")}catch{setStatus("Select and copy the message above")}}}>Copy message</button>{digits&&<><a href={`sms:${digits}?body=${encodeURIComponent(message)}`}>Open SMS</a><a target="_blank" rel="noopener noreferrer" href={`https://wa.me/${digits.replace(/\D/g,"")}?text=${encodeURIComponent(message)}`}>Open WhatsApp</a></>}<button type="button" onClick={async()=>{try{if(navigator.share)await navigator.share({text:message});else setStatus("Use Copy message to share")}catch{setStatus("Sharing cancelled")}}}>Share</button></div><small role="status">{status}</small></details></div>
}
