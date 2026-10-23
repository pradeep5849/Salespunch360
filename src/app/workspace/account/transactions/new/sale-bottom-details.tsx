"use client";
import Link from "next/link";
import type {SaleEditInitial} from "@/lib/account/sale-edit-initial";
import { GST_STATES } from "@/lib/account/gst-states";
import {Money} from "@/components/account/account-ui";
import {AccountDate,AccountCurrencySymbol} from "@/components/account/display-preferences";
import {useMemo,useState} from "react";
import styles from "./sale-bottom-details.module.css";

const states=GST_STATES;

function n(v:string){const x=Number(v);return Number.isFinite(x)?x:0}

export function useSaleBottomDetails({recordedPayments,advanceBalance=0,subtotal,taxTotal,defaultStateCode,roundingEnabled=false,roundingStep=1,termsEnabled=true,defaultTerms="",cashSale=false,showStateOfSupply=true,initialRoundOff,initialStateCode,editMode=false}:{recordedPayments?:SaleEditInitial["recordedPayments"];initialRoundOff?:string;initialStateCode?:string;editMode?:boolean;advanceBalance?:number;subtotal:number;taxTotal:number;defaultStateCode?:string|null;roundingEnabled?:boolean;roundingStep?:number;termsEnabled?:boolean;defaultTerms?:string;cashSale?:boolean;showStateOfSupply?:boolean}){
 const [roundOffEnabled,setRoundOffEnabled]=useState(initialRoundOff!==undefined?n(initialRoundOff)!==0:roundingEnabled),[roundOff,setRoundOff]=useState(initialRoundOff??""),[receivedEnabled,setReceivedEnabled]=useState(false),[received,setReceived]=useState(""),[paymentType,setPaymentType]=useState("CASH"),[stateOfSupplyCode,setStateOfSupplyCode]=useState(initialStateCode??"");
 const[notes,setNotes]=useState(defaultTerms);
 const [chequeNumber,setChequeNumber]=useState(""),[chequeDate,setChequeDate]=useState(""),[paymentReference,setPaymentReference]=useState("");
 const effectiveStateCode=showStateOfSupply?stateOfSupplyCode||defaultStateCode||"":defaultStateCode||"";
 const roundedAdjustment=roundOffEnabled?(roundOff!==""?n(roundOff):Math.round(subtotal/roundingStep)*roundingStep-subtotal):0;
 const total=useMemo(()=>subtotal+roundedAdjustment,[subtotal,roundedAdjustment]);
 const advanceApplied=Math.min(Math.max(0,total),Math.max(0,advanceBalance)),remaining=Math.max(0,total-advanceApplied);
 const receivedAmount=cashSale?remaining:receivedEnabled?Math.max(0,Math.min(remaining,n(received))):0;
 const balanceDue=Math.max(0,remaining-(paymentType==="CHEQUE"?0:receivedAmount));
 function toggleReceived(enabled:boolean){setReceivedEnabled(enabled);setReceived(enabled?remaining.toFixed(2):"")}
 const node=<section className={styles.wrap}>
   <div className={styles.sectionTitle}>Charges</div>
   {(roundingEnabled||initialRoundOff!==undefined)&&<div className={styles.row}><label className={styles.checkLabel}><input type="checkbox" checked={roundOffEnabled} onChange={e=>setRoundOffEnabled(e.target.checked)}/><span>Round Off</span></label><label className={styles.moneyInput}><AccountCurrencySymbol/><input type="number" step="0.01" min={-Math.max(10,roundingStep/2)} max={Math.max(10,roundingStep/2)} value={roundOff||roundedAdjustment.toFixed(2)} disabled={!roundOffEnabled} onChange={e=>setRoundOff(e.target.value)}/></label></div>}
   <div className={`${styles.row} ${styles.total}`}><strong>Total Amount</strong><strong><Money value={total}/></strong></div>
   {advanceApplied>0&&<div className={styles.row}><span>Advance applied</span><strong><Money value={advanceApplied}/></strong></div>}
   {editMode&&recordedPayments?<section aria-label="Recorded payments" className={styles.recorded}>
    <div className={styles.row}><span>Received on saved invoice</span><strong><Money value={recordedPayments.received}/></strong></div>
    <div className={styles.row}><span>Advance already applied</span><strong><Money value={recordedPayments.advanceApplied}/></strong></div>
    {Number(recordedPayments.credits??0)!==0&&<div className={styles.row}><span>Recorded credit adjustments</span><strong><Money value={recordedPayments.credits??"0"}/></strong></div>}
    {Number(recordedPayments.returnCreditsTransferred??0)!==0&&<p>Original billed return credit: <Money value={recordedPayments.originalReturnCredits??"0"}/>. Transferred to customer advance credit: <Money value={recordedPayments.returnCreditsTransferred??"0"}/>.</p>}
    <div className={styles.row}><span>Recorded payment discount</span><strong><Money value={recordedPayments.paymentDiscount}/></strong></div>
    <div className={`${styles.row} ${styles.balance}`}><strong>Recorded balance due</strong><strong><Money value={recordedPayments.outstanding}/></strong></div>
    {recordedPayments.receipts.map(receipt=><p key={receipt.id} style={{overflowWrap:"anywhere"}}>Applied receipt · <AccountDate value={receipt.date}/> · {receipt.mode} · <Money value={receipt.amount}/>{receipt.reference&&<> · Reference: {receipt.reference}</>}</p>)}
    <p>These are the saved payment amounts. An amount correction keeps actual payments available and removes the old payment discount. Record new payments separately after saving.</p>
   </section>:<>
   <div className={styles.row}><label className={styles.checkLabel}><input type="checkbox" checked={cashSale||receivedEnabled} disabled={cashSale||editMode} onChange={e=>toggleReceived(e.target.checked)}/><span>Received</span></label><label className={styles.moneyInput}><AccountCurrencySymbol/><input type="number" step="0.01" min="0" max={remaining} value={cashSale?remaining.toFixed(2):received} disabled={cashSale||editMode||!receivedEnabled} onChange={e=>setReceived(e.target.value)}/></label></div>
   <div className={`${styles.row} ${styles.balance}`}><strong>Balance Due</strong><strong><Money value={balanceDue}/></strong></div>
   <div className={styles.payment}><span>Payment Type</span><select aria-label="Payment Type" disabled={editMode} value={paymentType} onChange={e=>setPaymentType(e.target.value)}><option value="CASH">💵 Cash</option><option value="BANK">Bank</option><option value="CHEQUE">Cheque</option><option value="UPI">UPI</option><option value="CARD">Card</option></select></div>
   {paymentType==="CHEQUE"&&!editMode&&<><label>Cheque number<input value={chequeNumber} onChange={event=>setChequeNumber(event.target.value)} maxLength={80} required={receivedAmount>0}/></label><label>Cheque date<input type="date" value={chequeDate} onChange={event=>setChequeDate(event.target.value)} required={receivedAmount>0}/></label><p>The invoice stays unpaid until this cheque is closed.</p></>}
   {!editMode&&<label className={styles.reference}>Payment Ref No.<input aria-label="Payment Ref No." maxLength={160} value={paymentReference} disabled={receivedAmount<=0} onChange={event=>setPaymentReference(event.target.value)}/></label>}
   {editMode&&<p>Save invoice changes first, then record any new payment from Sale Details.</p>}
   </>}
   <Link className={styles.addPayment} href="/workspace/account/money/accounts">＋ Add Payment Type</Link>
   {showStateOfSupply&&<div className={styles.state}><label>State of Supply</label><select aria-label="State of Supply" value={effectiveStateCode} onChange={e=>setStateOfSupplyCode(e.target.value)}><option value="">Select State</option>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></div>}
   {termsEnabled&&<details className={styles.terms}><summary>Terms &amp; Conditions</summary><textarea aria-label="Terms & Conditions" maxLength={5000} value={notes} onChange={event=>setNotes(event.target.value)}/></details>}
   {taxTotal>0&&!effectiveStateCode&&<p className={styles.hint}>Select State of Supply for GST-taxed sales.</p>}
 </section>;
 return{stateOfSupplyCode:effectiveStateCode,roundOffAmount:roundedAdjustment.toFixed(2),notes:termsEnabled?notes:"",receivedAmount,paymentType,chequeNumber,chequeDate,paymentReference,total,balanceDue,node};
}
