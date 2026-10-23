"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {partyTransferInput,partyTransferAmounts} from "@/lib/account/party-transfer-policy";
import type {partyTransferOptionsForActor} from "@/lib/account/party-transfers";
type Options=Awaited<ReturnType<typeof partyTransferOptionsForActor>>;
export function PartyTransferForm({options,requestKey,today}:{options:Options;requestKey:string;today:string}){
 const router=useRouter(),[key,setKey]=useState(requestKey),[branch,setBranch]=useState(options.branches[0]?.id??""),[date,setDate]=useState(today),[account,setAccount]=useState(""),[receivedParty,setReceivedParty]=useState(""),[paidParty,setPaidParty]=useState(""),[received,setReceived]=useState(""),[paid,setPaid]=useState(""),[notes,setNotes]=useState(""),[photo,setPhoto]=useState<File|null>(null),[fileKey,setFileKey]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const parties=[...options.customers.filter(row=>row.branchId===branch).map(row=>({...row,key:`CUSTOMER:${row.id}`,label:`${row.name} (Customer)`})),...options.vendors.map(row=>({...row,key:`VENDOR:${row.id}`,label:`${row.name} (Vendor)`}))];
 const parseParty=(value:string)=>{const [kind,id]=value.split(":");return{kind,id}};
 let commission="0.00";try{commission=partyTransferAmounts({receivedAmount:received||"0",paidAmount:paid||"0"}).commissionAmount}catch{/* Validation below reports invalid amounts. */}
 async function save(saveNew:boolean){
  if(busy)return;setError("");
  const parsed=partyTransferInput.safeParse({requestKey:key,branchId:branch,moneyAccountId:account,transactionDate:date,receivedParty:parseParty(receivedParty),paidParty:parseParty(paidParty),receivedAmount:received,paidAmount:paid,notes});
  if(!parsed.success){setError(parsed.error.issues[0]?.message??"Review the transfer details.");return}
  setBusy(true);
  try{
   const form=new FormData();form.set("document",JSON.stringify(parsed.data));if(photo)form.set("photo",photo);
   const response=await fetch("/api/account/party-transfers",{method:"POST",body:form});const result=await response.json();
   if(!response.ok)throw new Error(result.message??"The transfer was not saved. Retry without changing the details.");
   if(saveNew){setKey(crypto.randomUUID());setReceivedParty("");setPaidParty("");setReceived("");setPaid("");setNotes("");setPhoto(null);setFileKey(value=>value+1);router.refresh()}
   else router.push(`/workspace/account/money/party-transfers/${encodeURIComponent(result.id)}`);
  }catch(err){setError(err instanceof Error?err.message:"The response was interrupted. Retry with the same details to avoid duplicate posting.")}
  finally{setBusy(false)}
 }
 return <form onSubmit={event=>{event.preventDefault();void save(false)}} className="account-form stack">
  <fieldset disabled={busy} style={{border:0,padding:0,display:"grid",gap:"1rem",minWidth:0}}>
   <label>Date<input aria-label="Transfer date" type="date" value={date} onChange={event=>setDate(event.target.value)} required/></label>
   <label>Firm<select aria-label="Firm" value={branch} onChange={event=>{setBranch(event.target.value);setReceivedParty("");setPaidParty("");setAccount("")}} required>{options.branches.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
   <label>Cash / Bank<select aria-label="Cash / Bank" value={account} onChange={event=>setAccount(event.target.value)} required><option value="">Select account</option>{options.accounts.filter(row=>!row.branchId||row.branchId===branch).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
   <section aria-label="Received from party"><h2>Received</h2><label>Received from<select aria-label="Received from" value={receivedParty} onChange={event=>setReceivedParty(event.target.value)} required><option value="">Select party</option>{parties.map(row=><option key={row.key} value={row.key}>{row.label}</option>)}</select></label><label>Received amount<input aria-label="Received amount" inputMode="decimal" value={received} onChange={event=>{setReceived(event.target.value);setPaid(event.target.value)}} required/></label></section>
   <section aria-label="Paid to party"><h2>Paid</h2><label>Paid to<select aria-label="Paid to" value={paidParty} onChange={event=>setPaidParty(event.target.value)} required><option value="">Select party</option>{parties.map(row=><option key={row.key} value={row.key}>{row.label}</option>)}</select></label><label>Paid amount<input aria-label="Paid amount" inputMode="decimal" value={paid} onChange={event=>setPaid(event.target.value)} required/></label></section>
   <p aria-live="polite" style={{color:"#334155"}}>Commission — Other Income: {commission}</p>
   <label>Add Note<textarea aria-label="Add Note" value={notes} maxLength={5000} onChange={event=>setNotes(event.target.value)}/></label>
   <label>Add image<input key={fileKey} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setPhoto(event.target.files?.[0]??null)}/></label>
   {error&&<p role="alert">{error}</p>}
   <div style={{display:"flex",gap:"1rem",flexWrap:"wrap"}}><button type="button" onClick={()=>void save(true)}>Save &amp; New</button><button type="submit">{busy?"Saving…":"Save"}</button></div>
  </fieldset>
 </form>;
}
