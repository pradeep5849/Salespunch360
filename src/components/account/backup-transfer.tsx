"use client";
import {useState} from "react";
export async function prepareBackupFile(includeFiles=false):Promise<File>{
 const response=await fetch(`/api/account/utilities/backup${includeFiles?"?includeFiles=true":""}`,{cache:"no-store"});
 if(!response.ok)throw new Error(response.status===403?"You do not have permission to create this backup.":"Backup generation failed. Please try again.");
 if(!response.headers.get("content-type")?.startsWith("application/json"))throw new Error("The server did not return a backup file.");
 const bytes=await response.arrayBuffer();
 const expected=response.headers.get("x-content-sha256");
 if(!expected||!bytes.byteLength)throw new Error("The backup checksum is missing or the file is empty.");
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
 if(digest!==expected.toLowerCase())throw new Error("Backup integrity verification failed. Please generate it again.");
 return new File([bytes],`salespunch360-backup-${new Date().toISOString().slice(0,10)}.json`,{type:"application/json"});
}
export function BackupTransfer({mode}:{mode:"phone"|"email"}){
 const [busy,setBusy]=useState(false),[file,setFile]=useState<File|null>(null),[error,setError]=useState(""),[message,setMessage]=useState(""),[includeFiles,setIncludeFiles]=useState(false);
 function download(){if(!file)return;const url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("Backup download requested. Check your device’s Downloads.");}
 async function share(){if(!file)return;setError("");try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:"SalesPunch360 backup"});setMessage("Backup handed to your selected app. Email delivery is not confirmed.");}else setMessage("File sharing is unavailable here. Download the backup and attach it in your email app.");}catch(e){if(e instanceof Error&&e.name==="AbortError")setMessage("Sharing cancelled. Your backup is still ready.");else setError("Could not open sharing. Download the backup and attach it manually.");}}
 return <section className="account-card"><h2>{mode==="phone"?"Backup to phone":"Backup to e-mail"}</h2><p>{mode==="phone"?"Generate a verified backup, then save it to this device.":"Generate a verified file, then choose your email app from the share options. Your confirmation is required to send it."}</p><label><input type="checkbox" checked={includeFiles} disabled={busy} onChange={e=>{setIncludeFiles(e.target.checked);setFile(null);setMessage("")}}/> Include live uploaded files and signatures (up to 64 MiB)</label><p>Backups contain company business data. Keep the downloaded file private.</p><button type="button" className="account-primary" disabled={busy} onClick={async()=>{setBusy(true);setError("");setMessage("");setFile(null);try{setFile(await prepareBackupFile(includeFiles));setMessage("Backup ready. Checksum verified.");}catch(e){setError(e instanceof Error?e.message:"Could not prepare backup.");}finally{setBusy(false)}}}>{busy?"Preparing backup…":"Generate backup"}</button>{file&&<div className="account-inline-actions">{mode==="email"&&<button type="button" onClick={share}>Open share options</button>}<button type="button" onClick={download}>Save backup to device</button></div>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</section>;
}
