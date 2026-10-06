"use client";
import {useMemo,useState} from "react";
import styles from "./sale-bottom-details.module.css";

const states=[
 ["01","Jammu & Kashmir"],["02","Himachal Pradesh"],["03","Punjab"],["04","Chandigarh"],["05","Uttarakhand"],["06","Haryana"],["07","Delhi"],["08","Rajasthan"],["09","Uttar Pradesh"],["10","Bihar"],["11","Sikkim"],["12","Arunachal Pradesh"],["13","Nagaland"],["14","Manipur"],["15","Mizoram"],["16","Tripura"],["17","Meghalaya"],["18","Assam"],["19","West Bengal"],["20","Jharkhand"],["21","Odisha"],["22","Chhattisgarh"],["23","Madhya Pradesh"],["24","Gujarat"],["26","Dadra & Nagar Haveli and Daman & Diu"],["27","Maharashtra"],["29","Karnataka"],["30","Goa"],["31","Lakshadweep"],["32","Kerala"],["33","Tamil Nadu"],["34","Puducherry"],["35","Andaman & Nicobar Islands"],["36","Telangana"],["37","Andhra Pradesh"],["38","Ladakh"]
] as const;

const money=new Intl.NumberFormat("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
function n(v:string){const x=Number(v);return Number.isFinite(x)?x:0}

export function useSaleBottomDetails({subtotal,taxTotal,defaultStateCode}:{subtotal:number;taxTotal:number;defaultStateCode?:string|null}){
 const [roundOffEnabled,setRoundOffEnabled]=useState(true),[roundOff,setRoundOff]=useState("0.00"),[receivedEnabled,setReceivedEnabled]=useState(false),[received,setReceived]=useState(""),[paymentType,setPaymentType]=useState("CASH"),[stateOfSupplyCode,setStateOfSupplyCode]=useState(defaultStateCode??"");
 const total=useMemo(()=>subtotal+(roundOffEnabled?n(roundOff):0),[subtotal,roundOffEnabled,roundOff]);
 const receivedAmount=receivedEnabled?Math.max(0,Math.min(total,n(received))):0;
 const balanceDue=Math.max(0,total-receivedAmount);
 const node=<section className={styles.wrap}>
   <div className={styles.sectionTitle}>Charges</div>
   <div className={styles.row}><label className={styles.checkLabel}><input type="checkbox" checked={roundOffEnabled} onChange={e=>setRoundOffEnabled(e.target.checked)}/><span>Round Off</span></label><label className={styles.moneyInput}>₹<input type="number" step="0.01" min="-10" max="10" value={roundOff} disabled={!roundOffEnabled} onChange={e=>setRoundOff(e.target.value)}/></label></div>
   <div className={`${styles.row} ${styles.total}`}><strong>Total Amount</strong><strong>₹ {money.format(total)}</strong></div>
   <div className={styles.row}><label className={styles.checkLabel}><input type="checkbox" checked={receivedEnabled} onChange={e=>setReceivedEnabled(e.target.checked)}/><span>Received</span></label><label className={styles.moneyInput}>₹<input type="number" step="0.01" min="0" max={Math.max(0,total)} value={received} disabled={!receivedEnabled} onChange={e=>setReceived(e.target.value)}/></label></div>
   <div className={`${styles.row} ${styles.balance}`}><strong>Balance Due</strong><strong>₹ {money.format(balanceDue)}</strong></div>
   <div className={styles.payment}><span>Payment Type</span><select value={paymentType} onChange={e=>setPaymentType(e.target.value)}><option value="CASH">💵 Cash</option><option value="BANK">Bank</option><option value="UPI">UPI</option><option value="CARD">Card</option></select></div>
   <button type="button" className={styles.addPayment}>＋ Add Payment Type</button>
   <div className={styles.state}><label>State of Supply</label><select value={stateOfSupplyCode} onChange={e=>setStateOfSupplyCode(e.target.value)}><option value="">Select State</option>{states.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></div>
   {taxTotal>0&&!stateOfSupplyCode&&<p className={styles.hint}>Select State of Supply for GST-taxed sales.</p>}
 </section>;
 return{stateOfSupplyCode,roundOffAmount:roundOffEnabled?roundOff:"0",receivedAmount,paymentType,total,balanceDue,node};
}
