import Link from "next/link";
import {documentOutstanding,listCommercialDocuments} from "@/lib/account/commercial";
import {AccountEmptyState,AccountPageHeader} from "@/components/account/account-shell";
import {humanize,Money} from "@/components/account/account-ui";
import {TransactionCardActions} from "./transaction-card-actions";
import styles from "./transactions.module.css";

export default async function Page(){
 const allRows=await listCommercialDocuments();
 // Normal Sale entry no longer exposes legacy drafts in the transaction list.
 const rows=allRows.filter(x=>!(x.type==="SALES_INVOICE"&&x.status==="DRAFT"));
 const cards=await Promise.all(rows.map(async x=>{
   const financial=x.type==="SALES_INVOICE"&&x.status==="POSTED"?await documentOutstanding(x.id):null;
   return{x,financial};
 }));
 return <>
  <AccountPageHeader title="Sales & Purchases" subtitle="Invoices, bills, orders, notes and their current business status." action={<Link className="account-primary" href="/workspace/account/transactions/new">New document</Link>}/>
  <nav className="account-segment-nav" aria-label="Transaction areas"><Link href="/workspace/account/transactions">Documents</Link><Link href="/workspace/account/transactions/money">Receipts, payments & advances</Link></nav>
  {cards.length?<div className={styles.list}>{cards.map(({x,financial})=>{const payment=financial?.paymentStatus;const sale=x.type==="SALES_INVOICE";const status=sale?(payment==="PAID"?"SALE : PAID":payment==="PARTIALLY_PAID"?"SALE : PARTIAL":"SALE : UNPAID"):humanize(x.status);const statusClass=payment==="PAID"?styles.paid:payment==="PARTIALLY_PAID"?styles.partial:styles.unpaid;const balance=financial?.outstanding??x.grandTotal;return <article className={styles.card} key={x.id}>
    <Link href={`/workspace/account/transactions/${x.id}`} style={{color:"inherit",textDecoration:"none"}}>
     <div className={styles.top}><div><div className={styles.party}>{x.partyName}</div><span className={`${styles.status} ${sale?statusClass:""}`}>{status}</span></div><div className={styles.meta}><strong>{x.documentNumber}</strong>{x.issueDate.toLocaleDateString("en-IN")}</div></div>
     <div className={styles.amounts}><div className={styles.amount}><small>Total</small><strong><Money value={x.grandTotal}/></strong></div><div className={styles.amount}><small>Balance</small><strong><Money value={balance}/></strong></div></div>
    </Link>
    <TransactionCardActions id={x.id} type={x.type} number={x.documentNumber} party={x.partyName} total={x.grandTotal.toString()}/>
   </article>})}</div>:<AccountEmptyState title="No sales or purchase documents yet" detail="Create your first invoice, bill, order or note to begin." action={<Link className="account-primary" href="/workspace/account/transactions/new">Create document</Link>}/>}</>;
}
