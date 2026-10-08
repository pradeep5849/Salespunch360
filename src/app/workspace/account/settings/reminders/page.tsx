import Link from "next/link";
import {requirePermission} from "@/lib/auth/authorization";
import styles from "@/components/account/reminder-settings.module.css";

export default async function Page(){
 await requirePermission("ACCOUNT_SETTINGS");
 return <main className={styles.root}>
  <header className={styles.header}><Link href="/workspace/account/settings" aria-label="Back">←</Link><h1>Reminders</h1></header>
  <section className={styles.landing}>
   <Link className={styles.card} href="/workspace/account/settings/reminders/payment"><div className={styles.cardTitle}><span>Payment Reminders</span><b aria-hidden>›</b></div></Link>
   <div className={styles.card}>
    <Link className={styles.cardTitle} href="/workspace/account/settings/reminders/service"><span>Service Reminders</span><b aria-hidden>›</b></Link>
    <div className={styles.benefits}>
     <div className={styles.benefitsTitle}>Benefits of Service Reminders:</div>
     <div className={styles.benefitGrid}>
      <div><div className={styles.benefitIcon}>♧</div><span>Remind your<br/>parties</span></div>
      <div><div className={styles.benefitIcon}>♙</div><span>Don&apos;t lose<br/>customers</span></div>
      <div><div className={styles.benefitIcon}>↗</div><span>Grow your<br/>business</span></div>
     </div>
    </div>
    <div className={styles.video}><div className={styles.videoThumb}>▶</div><div className={styles.videoText}><strong>How do Service Reminders work?</strong><span>Watch Video ›</span></div></div>
   </div>
  </section>
 </main>;
}
