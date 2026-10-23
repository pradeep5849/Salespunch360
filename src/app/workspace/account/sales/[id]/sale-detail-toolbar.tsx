"use client";

import Link from "next/link";
import {useRef,useState} from "react";
import {preparePrintPdf,isShareCancellation} from "@/components/account/share-print-file";
import {printPdfPageImages} from "@/components/account/print-page-images";
import styles from "./sale-detail.module.css";

export function SaleDetailToolbar({id,number,pdfUrl,canChange,shareAs}:{id:string;number:string;pdfUrl:string;canChange:boolean;shareAs:"ASK"|"PDF"}){
 const chooser=useRef<HTMLDialogElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[downloads,setDownloads]=useState<File[]>([]),[chooserOpen,setChooserOpen]=useState(false);
 const download=(file:File)=>{const url=URL.createObjectURL(file),link=document.createElement("a");link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const share=async(images=false)=>{
  if(busy)return;setBusy(true);setError("");setDownloads([]);
  try{
   const pdf=await preparePrintPdf(pdfUrl,number),files=images?await printPdfPageImages(pdf):[pdf];
   if(navigator.share&&navigator.canShare?.({files}))await navigator.share({files,title:number});
   else if(files.length===1)download(files[0]);
   else setDownloads(files);
   chooser.current?.close();
  }catch(cause){if(!isShareCancellation(cause))setError(cause instanceof Error?cause.message:"Could not prepare the invoice. Please try again.")}
  finally{setBusy(false)}
 };
 return <>
  <button type="button" className={styles.icon} disabled={busy} aria-label="Share invoice" onClick={()=>{setError("");if(shareAs==="PDF")void share();else {setChooserOpen(true);chooser.current?.showModal()}}}>↗</button>
  <details className={styles.more}><summary className={styles.icon} aria-label="More invoice actions">⋮</summary><nav className={styles.actionList} aria-label="Invoice actions"><a href={pdfUrl}>Preview / download PDF</a><Link href={`/workspace/account/transactions/${id}`}>Full transaction details</Link>{canChange&&<Link href={`/workspace/account/sales/${id}/edit`}>Edit saved Sale</Link>}</nav></details>
  <dialog onClose={()=>setChooserOpen(false)} ref={chooser} className={styles.shareDialog} aria-labelledby="sale-share-title"><h2 id="sale-share-title">Share invoice</h2><p>Select a format. Your browser will offer sharing or a download.</p><div><button type="button" disabled={busy} onClick={()=>void share()}>Share as PDF</button><button type="button" disabled={busy} onClick={()=>void share(true)}>Share as images</button><button type="button" disabled={busy} onClick={()=>chooser.current?.close()}>Cancel</button></div>{busy&&<p role="status">Preparing invoice…</p>}{error&&<p role="alert">{error}</p>}</dialog>
  {error&&!chooserOpen&&<p className={styles.toolbarNotice} role="alert">{error}</p>}
  {downloads.length>0&&<section className={styles.toolbarNotice} aria-label="Invoice image downloads"><p>Download each page:</p>{downloads.map((file,index)=><button key={file.name} type="button" onClick={()=>download(file)}>Download page {index+1}</button>)}</section>}
 </>;
}
