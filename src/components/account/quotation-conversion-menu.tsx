"use client";
import Link from "next/link";
import {useId,useRef} from "react";

export function QuotationConversionMenu({documentId,revisionId,canSale,canOrder}:{documentId:string;revisionId:string;canSale:boolean;canOrder:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),heading=useId();
 if(!canSale&&!canOrder)return null;
 const href=(type:string)=>`/workspace/account/transactions/new?type=${type}&quotationId=${documentId}&quotationRevisionId=${revisionId}`;
 return <><button type="button" onClick={()=>dialog.current?.showModal()}>Convert</button><dialog ref={dialog} aria-labelledby={heading} style={{width:400,maxWidth:"calc(100vw - 32px)",maxHeight:"calc(100dvh - 32px)",overflowY:"auto",boxSizing:"border-box",padding:24,borderRadius:12,background:"white",color:"#111827"}}><h2 id={heading}>Convert estimate</h2><p>Review the approved estimate in the new document before saving.</p><div style={{display:"grid",gap:16}}>{canSale&&<Link prefetch={false} onClick={()=>dialog.current?.close()} style={{color:"#075985"}} href={href("SALES_INVOICE")}>Convert to Sale</Link>}{canOrder&&<Link prefetch={false} onClick={()=>dialog.current?.close()} style={{color:"#075985"}} href={href("SALES_ORDER")}>Convert to Sale Order</Link>}</div><form method="dialog" style={{marginTop:20}}><button>Cancel</button></form></dialog></>;
}
