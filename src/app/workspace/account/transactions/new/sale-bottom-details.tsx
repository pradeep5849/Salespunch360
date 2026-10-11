"use client";
import Link from "next/link";
import {Money} from "@/components/account/account-ui";
import {AccountCurrencySymbol} from "@/components/account/display-preferences";
import {useMemo,useState} from "react";
import styles from "./sale-bottom-details.module.css";

const states=[
 ["01","Jammu & Kashmir"],["02","Himachal Pradesh"],["03","Punjab"],["04","Chandigarh"],["05","Uttarakhand"],["06","Haryana"],["07","Delhi"],["08","Rajasthan"],["09","Uttar Pradesh"],["10","Bihar"],["11","Sikkim"],["12","Arunachal Pradesh"],["13","Nagaland"],["14","Manipur"],["15","Mizoram"],["16","Tripura"],["17","Meghalaya"],["18","Assam"],["19","West Bengal"],["20","Jharkhand"],["21","Odisha"],["22","Chhattisgarh"],["23","Madhya Pradesh"],["24","Gujarat"],["26","Dadra & Nagar Haveli and Daman & Diu"],["27","Maharashtra"],["29","Karnataka"],["30","Goa"],["31","Lakshadweep"],["32","Kerala"],["33","Tamil Nadu"],["34","Puducherry"],["35","Andaman & Nicobar Islands"],["36","Telangana"],["37","Andhra Pradesh"],["38","Ladakh"]
] as const;

function n(v:string){const x=Number(v);return Number.isFinite(x)?x:0}

export function useSaleBottomDetails({advanceBalance=0,subtotal,taxTotal,defaultStateCode,roundingEnabled=false,roundingStep=1,termsEnabled=true,defaultTerms="",cashSale=false,showStateOfSupply=true,initialRoundOff,initialStateCode,editMode=false}:{initialRoundOff?:string;initialStateCode?:string;editMode?:boolean;advanceBalance?:number;subtotal:number;taxTotal:number;defaultStateCode?:string|null;roundingEnabled?:boolean;roundingStep?:number;termsEnabled?:boolean;defaultTerms?:string;cashSale?:boolean;showStateOfSupply?:boolean}){
 const [roundOffEnabled,setRoundOffEnabled]=useState(initialRoundOff!==undefined?n(initialRoundOff)!==0:roundingEnabled),[roundOff,setRoundOff]=useState(initialRoundOff??""),[receivedEnabled,setReceivedEnabled]=useState(false),[received,setReceived]=useState(""),[paymentType,setPaymentType]=useState("CASH"),[stateOfSupplyCode,setStateOfSupplyCode]=useState(initialStateCode??"");
 const[notes,setNotes]=useState(defaultTerms);
 const effectiveStateCode=showStateOfSupply?stateOfSupplyCode||defaultStateCode||"":defaultStateCode||"";
 const roundedAdjustment=roundOffEnabled?(roundOff!==""?n(roundOff):Math.round(subtotal/roundingStep)*roundingStep-subtotal):0;
 const total=useMemo(()=>subtotal+roundedAdjustment,[subtotal,roundedAdjustment]);
 const advanceApplied=Math.min(Math.max(0,total),Math.max(0,advanceBalance)),remaining=Math.max(0,total-advanceApplied);
 const receivedAmount=cashSale?remaining:receivedEnabled?Math.max(0,Math.min(remaining,n(received))):0;
 const balanceDue=Math.max(0,remaining-receivedAmount);
 function toggleReceived(enabled:boolean){setReceivedEnabled(enabled);setReceived(enabled?remaining.toFixed(2):"")}
 const node=<section className={styles.wrap}>
   <div className={styles.sectionTitle}>Charges</div>
   {(roundingEnabled||initialRoundOff!==undefined)&&<div className={styles.row}><label className={styles.checkLabel}><input type="checkbox" checked={roundOffEnabled} onChange={e=>setRoundOffEnabled(e.target.checked)}/><span>Round Off</span></label><label className={styles.moneyInput}><AccountCurrencySymbol/><input type="number" step="0.01" min={-Math.max(10,roundingStep/2)} max={Math.max(10,roundingStep/2)} value={roundOff||roundedAdjustment.toFixed(2)} disabled={!roundOffEnabled} onChange={e=>setRoundOff(e.target.value)}/></label></div>}
   <div className={`${styles.row} ${styles.total}`}><strong>Total Amount</strong><strong><Money value={total}/></strong></div>
   {advanceApplied>0&&<div className={styles.row}><span>Advance applied</span><strong><Money value={advanceApplied}/></strong></div>}
   <div className={styles.row}><label className={styles.checkLabel}><input type="checkbox" checked={cashSale||receivedEnabled} disabled={cashSale||editMode} onChange={e=>toggleReceived(e.target.checked)}/><span>Received</span></label><label className={styles.moneyInput}><AccountCurrencySymbol/><input type="number" step="0.01" min="0" max={remaining} value={cashSale?remaining.toFixed(2):received} disabled={cashSale||editMode||!receivedEnabled} onChange={e=>setReceived(e.target.value)}/></label></div>
   <div className={`${styles.row} ${styles.balance}`}><strong>Balance Due</strong><strong><Money value={balanceDue}/></strong></div>
   <div className={styles.payment}><span>Payment Type</span><select disabled={editMode} value={paymentType} onChange={e=>setPaymentType(e.target.value)}><option value="CASH">💵 Cash</option><option value="BANK">Bank</option><option value="UPI">UPI</option><option value="CARD">Card</option></select></div>
   {editMode&&<p>Save invoice changes first, then record any new payment from Sale Details.</p>}
   <Link className={styles.addPayment} href="/workspace/account/money/accounts">＋ Add Payment Type</Link>
   {showStateOfSupply&&<div className={styles.state}><label>State of Supply</label><select aria-label="State of Supply" value={effectiveStateCode} onChange={e=>setStateOfSupplyCode(e.target.value)}><option value="">Select State</option>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></div>}
   {termsEnabled&&<details className={styles.terms}><summary>Terms &amp; Conditions</summary><textarea aria-label="Terms & Conditions" maxLength={5000} value={notes} onChange={event=>setNotes(event.target.value)}/></details>}
   {taxTotal>0&&!effectiveStateCode&&<p className={styles.hint}>Select State of Supply for GST-taxed sales.</p>}
 </section>;
 return{stateOfSupplyCode:effectiveStateCode,roundOffAmount:roundedAdjustment.toFixed(2),notes:termsEnabled?notes:"",receivedAmount,paymentType,total,balanceDue,node};
}
