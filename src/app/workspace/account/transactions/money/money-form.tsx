"use client";
import {useDisplayPreferences} from "@/components/account/display-preferences";
import {formatMoney,formatCalendarDate} from "@/lib/account/display-preferences";
import {paymentSettlementAmount,resolveInitialMoneyType} from "@/lib/account/payment-discount";
import {reportCalendarDate} from "@/lib/account/reports/dates";
import Link from "next/link";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {saveSettlementWithFeedback} from "@/app/actions/commercial";
type O={id:string;name:string;branchId?:string|null;type?:string};
type Doc={id:string;documentNumber:string;partyId:string;branchId:string;projectId?:string|null;outstanding:string;type:string};
type Project={id:string;projectNumber:string;name:string;customerId:string;branchId:string};
type Opening={id:string;partyId:string;branchId:string;partyType:string;effectiveDate:string;outstanding:string};
export {resolveInitialMoneyType} from "@/lib/account/payment-discount";
export function allocationForTarget(target:string,amount:string){const [kind,id]=target.split(":");return kind==="opening"?{openingBalanceId:id,amount}:{documentId:id,amount}}
const cents=(value:string)=>/^\d{1,16}(\.\d{1,2})?$/.test(value)?BigInt(value.replace(".","").padEnd(value.includes(".")?value.split(".")[0].length+2:value.length,"0"))*(value.includes(".")?BigInt(1):BigInt(100)):BigInt(0);
const decimal=(value:bigint)=>`${value/BigInt(100)}.${String(value%BigInt(100)).padStart(2,"0")}`;
type PaymentDraft={type:string;branchId:string;partyId:string;paymentMode:string;moneyAccountId:string;amount:string;notes:string};
export function MoneyForm({initialDraft,allowedTypes,initialType,initialProjectId,initialBranchId,branches,customers,vendors,documents,openings,moneyAccounts,projects,discountEnabled=false,companyName}:{initialDraft?:PaymentDraft;discountEnabled?:boolean;allowedTypes:string[];initialType?:string;initialProjectId?:string;initialBranchId?:string;branches:O[];customers:O[];vendors:O[];documents:Doc[];openings:Opening[];moneyAccounts:O[];projects:Project[];companyName?:string}){
 const display=useDisplayPreferences(),router=useRouter(),initialProject=projects.find(row=>row.id===initialProjectId);
 const [pending,setPending]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [type,setType]=useState(()=>resolveInitialMoneyType(allowedTypes,initialDraft?.type??initialType)),[branchId,setBranch]=useState(initialDraft?.branchId??initialProject?.branchId??branches.find(row=>row.id===initialBranchId)?.id??branches[0]?.id??""),[partyId,setParty]=useState(initialDraft?.partyId??initialProject?.customerId??""),[projectId,setProject]=useState(initialProject?.id??"");
 const [amount,setAmount]=useState(initialDraft?.amount??""),[paymentDiscount,setPaymentDiscount]=useState(""),[target,setTarget]=useState(""),[paymentMode,setMode]=useState(initialDraft?.paymentMode??"BANK"),[moneyAccountId,setMoneyAccount]=useState(initialDraft?.moneyAccountId??""),[reference,setReference]=useState(""),[notes,setNotes]=useState(initialDraft?.notes??""),[date,setDate]=useState(()=>reportCalendarDate()),[idempotencyKey,setKey]=useState(()=>crypto.randomUUID());
 const [multiple,setMultiple]=useState(Boolean(initialDraft)),[links,setLinks]=useState<{target:string;amount:string}[]>([]);
 const vendor=type.startsWith("VENDOR"),advance=type.endsWith("ADVANCE"),projectOptions=projects.filter(row=>row.customerId===partyId&&row.branchId===branchId);
 const docs=documents.filter(row=>row.partyId===partyId&&row.branchId===branchId&&(!projectId||row.projectId===projectId)&&row.type===(vendor?"PURCHASE_BILL":"SALES_INVOICE"));
 const openingTargets=openings.filter(row=>row.partyId===partyId&&row.branchId===branchId&&row.partyType===(vendor?"VENDOR":"CUSTOMER"));
 const discount=type==="CUSTOMER_RECEIPT"&&discountEnabled&&target.startsWith("document:")&&!multiple;
 const allocations=advance?[]:multiple?links.filter(row=>row.target&&cents(row.amount)>BigInt(0)).map(row=>allocationForTarget(row.target,row.amount)):[{...allocationForTarget(target,discount?paymentSettlementAmount(amount,paymentDiscount):amount),...(discount?{discountAmount:paymentDiscount||"0"}:{})}];
 const [chequeNumber,setChequeNumber]=useState(""),[chequeDate,setChequeDate]=useState(reportCalendarDate());
 const [billingName,setBillingName]=useState(""),[billingAddress,setBillingAddress]=useState("");
 const [partySearch,setPartySearch]=useState("");
 const eligibleParties=(vendor?vendors:customers.filter(row=>!row.branchId||row.branchId===branchId)).filter(row=>row.name.toLowerCase().includes(partySearch.trim().toLowerCase())||row.id===partyId);
 const outstandingByTarget=new Map([...docs.map(row=>[`document:${row.id}`,cents(row.outstanding)] as const),...openingTargets.map(row=>[`opening:${row.id}`,cents(row.outstanding)] as const)]);
 const linkedByTarget=new Map<string,bigint>();for(const row of links){linkedByTarget.set(row.target,(linkedByTarget.get(row.target)??BigInt(0))+cents(row.amount));}
 const overAllocated=[...linkedByTarget].some(([key,value])=>value>(outstandingByTarget.get(key)??BigInt(0)));
 const customerBalance=[...docs,...openingTargets].reduce((sum,row)=>sum+cents(row.outstanding),BigInt(0));
 const unused=advance?cents(amount):multiple?cents(amount)-links.reduce((sum,row)=>sum+cents(row.amount),BigInt(0)):BigInt(0);
 const payload={idempotencyKey,type,branchId,partyId,projectId:projectId||undefined,paymentMode,moneyAccountId:moneyAccountId||undefined,amount,transactionDate:date,reference,notes,billingName,billingAddress,allocations,...(paymentMode==="CHEQUE"?{chequeNumber,chequeDate}:{})};
 function clearLinks(){setTarget("");setPaymentDiscount("");setLinks([]);}
 function targetOptions(){return <><option value="">Select target</option>{docs.map(row=><option key={row.id} value={`document:${row.id}`}>{vendor?"Bill":"Invoice"} {row.documentNumber} · {formatMoney(row.outstanding,display)} outstanding</option>)}{openingTargets.map(row=><option key={row.id} value={`opening:${row.id}`}>Opening balance · {formatCalendarDate(row.effectiveDate,display)} · {formatMoney(row.outstanding,display)} outstanding</option>)}</>}
 return <form action={async form=>{if(pending)return;setPending(true);setError("");setMessage("");try{
  if(multiple&&(unused<BigInt(0)||overAllocated)){setError(overAllocated?"Linked amount exceeds an invoice outstanding balance.":"Linked amounts exceed the payment.");return;}
  const result=await saveSettlementWithFeedback(form);
  if(result.kind==="error")setError(result.message);
  else if(form.get("saveMode")==="new"){setAmount("");setPaymentDiscount("");setTarget("");setLinks([]);setNotes("");setBillingName("");setBillingAddress("");setReference("");setChequeNumber("");setKey(crypto.randomUUID());setMessage(paymentMode==="CHEQUE"?"Cheque saved as pending. Ready for a new entry.":"Payment posted. Ready for a new entry.");router.refresh();}
  else if(result.redirectTo)router.push(result.redirectTo);
 }catch{setError("Unable to confirm posting. Keep these inputs and retry the same payment; check recent entries before starting another.");}finally{setPending(false);}}} onReset={event=>event.preventDefault()} className="stack">
 {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{companyName&&<p>Firm: {companyName}</p>}{initialDraft&&<p>This is a new payment template. The original allocations, discount, date and bank reference were not copied. Review it before saving; saving records a new cash movement.</p>}
 <input type="hidden" name="payload" value={JSON.stringify(payload)}/><fieldset disabled={pending}>
 <label>Transaction<select value={type} onChange={event=>{setType(event.target.value);setParty("");setProject("");clearLinks();}}>{allowedTypes.map(value=><option key={value}>{value}</option>)}</select></label>
 <p>Receipt/payment number is assigned by the server after saving.</p>
 <label>Date<input type="date" value={date} onChange={event=>setDate(event.target.value)} required/></label>
 <label>Branch<select value={branchId} onChange={event=>{setBranch(event.target.value);setParty("");setProject("");clearLinks();}}>{branches.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
 <label>Search {vendor?"vendor":"customer"}<input type="search" value={partySearch} onChange={event=>setPartySearch(event.target.value)} placeholder="Search saved parties"/></label><label>{vendor?"Vendor":"Customer"}<select aria-label={vendor?"Vendor":"Customer"} value={partyId} onChange={event=>{setParty(event.target.value);setBillingName((vendor?vendors:customers).find(row=>row.id===event.target.value)?.name??"");setProject("");clearLinks();}} required><option value="">Select</option>{eligibleParties.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><Link href="/workspace/account/customers/new">+ Add New Party</Link>
 {partyId&&<p>Party Balance: {formatMoney(decimal(customerBalance),display)}</p>}
 <p>Open document and opening balance: {formatMoney(decimal([...docs,...openingTargets].reduce((sum,row)=>sum+cents(row.outstanding),BigInt(0))),display)}</p>
 <label>Project<select value={projectId} onChange={event=>{setProject(event.target.value);clearLinks();}}><option value="">Non-project payment</option>{projectOptions.map(row=><option key={row.id} value={row.id}>{row.projectNumber} · {row.name}</option>)}</select></label>
 <label>Payment mode<select aria-label="Payment mode" value={paymentMode} onChange={event=>setMode(event.target.value)}><option>CASH</option><option>BANK</option><option>CHEQUE</option></select></label>
 <label>Money Account<select required={paymentMode==="CHEQUE"} value={moneyAccountId} onChange={event=>setMoneyAccount(event.target.value)}><option value="">{paymentMode==="CHEQUE"?"Select a bank account":`Legacy ${paymentMode}`}</option>{moneyAccounts.filter(row=>(!row.branchId||row.branchId===branchId)&&(paymentMode!=="CHEQUE"||row.type==="BANK")).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><Link href="/workspace/account/money/accounts">+ Add Payment Type (new account)</Link>
 {paymentMode==="CHEQUE"&&<><label>Cheque number<input value={chequeNumber} maxLength={80} onChange={event=>setChequeNumber(event.target.value)} required/></label><label>Cheque date<input type="date" value={chequeDate} onChange={event=>setChequeDate(event.target.value)} required/></label><p>The payment stays pending until the cheque is cleared. No cash or linked payment is posted before clearance.</p></>}
 <label>{vendor?"Paid":"Received"}<input type="number" min="0.01" step="0.01" value={amount} onChange={event=>setAmount(event.target.value)} required/></label>
 {!advance&&<><label><input type="checkbox" checked={multiple} onChange={event=>{setMultiple(event.target.checked);clearLinks();}}/> Link multiple transactions or keep an unused amount</label>
 {multiple?<section><p>The unlinked amount is retained as an advance. Cash is recorded once. Linking an existing advance later does not record cash again.</p>{links.map((row,index)=><div key={index}><label>Target<select value={row.target} onChange={event=>setLinks(links.map((value,i)=>i===index?{...value,target:event.target.value}:value))} required>{targetOptions()}</select></label><label>Link amount<input type="number" min="0.01" step="0.01" max={decimal(outstandingByTarget.get(row.target)??BigInt(0))} value={row.amount} required onChange={event=>setLinks(links.map((value,i)=>i===index?{...value,amount:event.target.value}:value))}/></label><button type="button" onClick={()=>setLinks(links.filter((_,i)=>i!==index))}>Remove link</button></div>)}<button type="button" onClick={()=>setLinks([...links,{target:"",amount:""}])}>Add transaction link</button>{overAllocated&&<p role="alert">Linked amount exceeds an invoice outstanding balance.</p>}<p>Unused amount: {unused>=BigInt(0)?formatMoney(decimal(unused),display):"Linked amounts exceed payment"}</p></section>:<label>Allocation target<select aria-label="Allocation target" value={target} onChange={event=>{setTarget(event.target.value);setPaymentDiscount("");}} required>{targetOptions()}</select></label>}
 </>}
 {discount&&<label>Payment Discount<input aria-label="Payment Discount" type="number" min="0" step="0.01" value={paymentDiscount} onChange={event=>setPaymentDiscount(event.target.value)}/><small>Cash received {formatMoney(amount||"0",display)} + discount {formatMoney(paymentDiscount||"0",display)} settles {formatMoney(paymentSettlementAmount(amount,paymentDiscount),display)}.</small></label>}
 <label>Billing name (optional)<input maxLength={240} value={billingName} onChange={event=>setBillingName(event.target.value)}/></label><label>Billing address (optional)<textarea maxLength={2000} value={billingAddress} onChange={event=>setBillingAddress(event.target.value)}/></label>
 <label>Supporting evidence (PDF, PNG or JPEG; 10 MB combined)<input key={idempotencyKey} type="file" name="attachments" multiple accept="application/pdf,image/png,image/jpeg"/></label>
 <label>Reference<input maxLength={160} value={reference} onChange={event=>setReference(event.target.value)}/></label><label>Notes<textarea maxLength={5000} value={notes} onChange={event=>setNotes(event.target.value)}/></label>
 <Link href="/workspace/account/settings/transactions">Transaction settings</Link>
 <button type="submit" name="saveMode" value="close">{pending?"Posting…":"Save"}</button><button type="submit" name="saveMode" value="new">Save &amp; New</button>
 </fieldset></form>;
}
