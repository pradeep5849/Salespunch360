"use client";
import Link from "next/link";
import {useRef} from "react";
import styles from "./tax-settings-reference.module.css";

export type TaxPreferences={gst?:boolean;hsnSac?:boolean;additionalCess?:boolean;reverseCharge?:boolean;stateOfSupply?:boolean;ewayBillNumber?:boolean;compositeScheme?:boolean;enableTcs?:boolean;enableTds?:boolean};
type Props={values:TaxPreferences;action:(fd:FormData)=>Promise<void>};
export function TaxSettingsReference({values,action}:Props){
 const form=useRef<HTMLFormElement>(null);
 const submit=()=>setTimeout(()=>form.current?.requestSubmit(),0);
 const toggle=(name:keyof TaxPreferences,label:string,defaultValue:boolean)=><label className={styles.row}><span>{label} <i className={styles.info}>i</i></span><input className={styles.switch} type="checkbox" name={name} defaultChecked={values[name]??defaultValue} onChange={submit}/></label>;
 return <main className={styles.root}>
  <header className={styles.header}><Link href="/workspace/account/settings" aria-label="Back">←</Link><h1>Taxes &amp; GST</h1><button type="button" aria-label="Search">⌕</button></header>
  <Link className={styles.linkRow} href="/workspace/account/tax/list"><span>Tax List</span><b aria-hidden>›</b></Link>
  <form ref={form} action={action}>
   {toggle("gst","GST",true)}
   {toggle("hsnSac","HSN/SAC Code",true)}
   {toggle("additionalCess","Additional CESS",false)}
   {toggle("reverseCharge","Reverse Charge",false)}
   {toggle("stateOfSupply","State of Supply",true)}
   {toggle("ewayBillNumber","E-Way Bill No.",false)}
   {toggle("compositeScheme","Composite Scheme",false)}
   {toggle("enableTcs","Enable TCS",false)}
   {toggle("enableTds","Enable TDS",false)}
  </form>
 </main>;
}
