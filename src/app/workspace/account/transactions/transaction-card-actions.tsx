"use client";
import Link from "next/link";
import styles from "./transactions.module.css";

function PrintIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3h10v5h1a3 3 0 0 1 3 3v6h-4v4H7v-4H3v-6a3 3 0 0 1 3-3h1Zm2-3v3h6V5H9Zm6 14v-5H9v5h6Zm3-4h1v-4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v4h2v-3h10v3h1Z"/></svg>}
function ShareIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.38 1.18l-7-3.5a3.2 3.2 0 0 0 0-1.36l7-3.5A3 3 0 1 0 15 7c0 .13.01.26.03.38l-7 3.5a3 3 0 1 0 0 4.24l7 3.5A3 3 0 1 0 18 16Zm0-11a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM6 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm12 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>}
function MoreIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>}

export function TransactionCardActions({id,type,number,party,total}:{id:string;type:string;number:string;party:string;total:string}){
 async function share(){const text=`${party} • ${number} • ₹${total}`;try{if(navigator.share)await navigator.share({title:`Invoice ${number}`,text});else await navigator.clipboard.writeText(text)}catch{}}
 return <div className={styles.actions} onClick={e=>e.stopPropagation()} aria-label="Transaction actions">
   <a className={styles.actionIcon} aria-label="Print" title="Print" href={`/api/account/print/${encodeURIComponent(type)}/${encodeURIComponent(id)}?format=pdf`} target="_blank" rel="noreferrer"><PrintIcon/></a>
   <button className={styles.actionIcon} aria-label="Share" title="Share" type="button" onClick={share}><ShareIcon/></button>
   <Link className={styles.actionIcon} aria-label="More" title="More" href={`/workspace/account/transactions/${id}`}><MoreIcon/></Link>
 </div>
}
