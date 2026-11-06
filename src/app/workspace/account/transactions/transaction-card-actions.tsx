"use client";
import {useState} from "react";
import {preparePrintPdf,isShareCancellation} from "@/components/account/share-print-file";
import Link from "next/link";
import styles from "./transactions.module.css";

function PrintIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5h1a3 3 0 0 1 3 3v6h-4v4H7v-4H3v-6a3 3 0 0 1 3-3h1Zm2-3v3h6V5H9Zm6 14v-5H9v5h6Zm3-4h1v-4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v4h2v-3h10v3h1Z"/></svg>}
function ShareIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.38 1.18l-7-3.5a3.2 3.2 0 0 0 0-1.36l7-3.5A3 3 0 1 0 15 7c0 .13.01.26.03.38l-7 3.5a3 3 0 1 0 0 4.24l7 3.5A3 3 0 1 0 18 16Zm0-11a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM6 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm12 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>}
function MoreIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>}

export function TransactionCardActions({id,type,number,party}:{id:string;type:string;number:string;party:string;total:string}){
 const [busy,setBusy]=useState(false),[feedback,setFeedback]=useState("");
 async function share(){if(busy)return;setBusy(true);setFeedback("");try{const file=await preparePrintPdf(`/api/account/print/${encodeURIComponent(type)}/${encodeURIComponent(id)}?format=pdf`,number);if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:`${party} · ${number}`,files:[file]});setFeedback("Document handed to your sharing app.")}else{const url=URL.createObjectURL(file),link=document.createElement("a");link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setFeedback("PDF downloaded for sharing.")}}catch(error){if(!isShareCancellation(error))setFeedback(error instanceof Error?error.message:"Could not share the document. Retry.")}finally{setBusy(false)}}
 return <div className={styles.actions} onClick={e=>e.stopPropagation()} aria-label="Transaction actions">
   <a className={styles.actionIcon} aria-label="Print" title="Print" href={`/api/account/print/${encodeURIComponent(type)}/${encodeURIComponent(id)}?format=pdf`} target="_blank" rel="noreferrer"><PrintIcon/></a>
   <button className={styles.actionIcon} aria-label="Share PDF" title="Share PDF" type="button" disabled={busy} onClick={share}><ShareIcon/></button>
   <Link className={styles.actionIcon} aria-label="More" title="More" href={`/workspace/account/transactions/${id}`}><MoreIcon/></Link>
   {(feedback||busy)&&<span role="status">{busy?"Preparing authorized PDF…":feedback}</span>}
 </div>
}
