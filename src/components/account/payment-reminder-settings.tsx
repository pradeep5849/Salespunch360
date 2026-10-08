"use client";
import Link from "next/link";
import {useRef,useState} from "react";
import styles from "./reminder-settings.module.css";

type Values={enabled?:boolean;overdueDays?:number;frequency?:string};
type Props={values:Values;action:(fd:FormData)=>Promise<void>};
export function PaymentReminderSettings({values,action}:Props){
 const form=useRef<HTMLFormElement>(null);
 const[days,setDays]=useState(Math.max(0,Math.min(365,Number(values.overdueDays??1))));
 const submit=()=>setTimeout(()=>form.current?.requestSubmit(),0);
 return <main className={styles.sheet}>
  <header className={styles.header}><Link href="/workspace/account/settings/reminders" aria-label="Back">←</Link><h1>Payment Reminder</h1><button type="button" aria-label="Search">⌕</button></header>
  <form ref={form} action={action}>
   <label className={styles.row}><span>Self Payment Reminder <i className={styles.info}>i</i></span><input className={styles.switch} type="checkbox" name="enabled" defaultChecked={values.enabled??true} onChange={submit}/></label>
   <div className={styles.row}><span>Remind me for payment due<br/>more than</span><div className={styles.step}><button type="button" onClick={()=>{setDays(v=>Math.max(0,v-1));submit()}}>−</button><output>{days}</output><input type="hidden" name="overdueDays" value={days}/><button type="button" onClick={()=>{setDays(v=>Math.min(365,v+1));submit()}}>+</button></div></div>
   <label className={styles.row}><span>Self Payment<br/>Reminder</span><select className={styles.select} name="frequency" defaultValue={values.frequency??"TWICE_DAILY"} onChange={submit}><option value="ONCE_DAILY">1 Time a day</option><option value="TWICE_DAILY">2 Times a day</option><option value="THREE_DAILY">3 Times a day</option><option value="WEEKLY">Once a week</option></select></label>
  </form>
  <div className={styles.sectionTitle}>Payment Reminder For party</div>
  <Link className={styles.linkRow} href="/workspace/account/settings/reminders/payment/message"><span>Reminder message to party <i className={styles.info}>i</i></span><b aria-hidden>›</b></Link>
 </main>;
}
