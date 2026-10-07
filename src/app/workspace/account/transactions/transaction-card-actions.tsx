"use client";
import Link from "next/link";
import styles from "./transactions.module.css";

export function TransactionCardActions({id,type,number,party,total}:{id:string;type:string;number:string;party:string;total:string}){
 async function share(){const text=`${party} • ${number} • ₹${total}`;try{if(navigator.share)await navigator.share({title:`Invoice ${number}`,text});else await navigator.clipboard.writeText(text)}catch{}}
 return <div className={styles.actions} onClick={e=>e.stopPropagation()}>
   <a href={`/api/account/print/${encodeURIComponent(type)}/${encodeURIComponent(id)}?format=pdf`} target="_blank" rel="noreferrer">▣<span>Print</span></a>
   <button type="button" onClick={share}>↗<span>Share</span></button>
   <Link href={`/workspace/account/transactions/${id}`}>⋮<span>More</span></Link>
 </div>
}
