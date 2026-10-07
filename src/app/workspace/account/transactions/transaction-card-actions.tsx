"use client";
import Link from "next/link";
import styles from "./transactions.module.css";

export function TransactionCardActions({id,type,number,party,total}:{id:string;type:string;number:string;party:string;total:string}){
 async function share(){const text=`${party} • ${number} • ₹${total}`;try{if(navigator.share)await navigator.share({title:`Invoice ${number}`,text});else await navigator.clipboard.writeText(text)}catch{}}
 return <div className={styles.actions} onClick={e=>e.stopPropagation()}>
   <a aria-label="Print" title="Print" href={`/api/account/print/${encodeURIComponent(type)}/${encodeURIComponent(id)}?format=pdf`} target="_blank" rel="noreferrer">▣</a>
   <button aria-label="Share" title="Share" type="button" onClick={share}>↗</button>
   <Link aria-label="More" title="More" href={`/workspace/account/transactions/${id}`}>⋮</Link>
 </div>
}
