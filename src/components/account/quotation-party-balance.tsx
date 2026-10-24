"use client";
import {useEffect,useState} from "react";
import {getQuotationPartyBalanceAction} from "@/app/actions/quotations";
import {Money} from "./account-ui";
/** Parent keys this component by party/branch, so a prior selection's amount never reappears. */
export function QuotationPartyBalance({partyId,branchId}:{partyId:string;branchId:string}){
 const [attempt,setAttempt]=useState(0),[result,setResult]=useState<{attempt:number;balance?:string;failed?:boolean}>();
 useEffect(()=>{
  if(!partyId||!branchId)return;
  let active=true;
  void getQuotationPartyBalanceAction({partyId,branchId}).then(value=>{
   if(!active)return;
   if(value.ok&&value.partyId===partyId&&value.branchId===branchId&&/^-?\d+(\.\d+)?$/.test(value.balance))setResult({attempt,balance:value.balance});
   else setResult({attempt,failed:true});
  }).catch(()=>{if(active)setResult({attempt,failed:true})});
  return()=>{active=false};
 },[partyId,branchId,attempt]);
 if(!partyId||!branchId)return null;
 const current=result?.attempt===attempt?result:undefined;
 return <p style={{color:"#526078"}} aria-live="polite" title="Posted party balance within your authorized branches, including openings, receipts and advances.">Party balance: {current?.balance!==undefined?<Money value={current.balance}/>:current?.failed?<>Unavailable. <button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry party balance</button></>:"Loading…"}</p>;
}
