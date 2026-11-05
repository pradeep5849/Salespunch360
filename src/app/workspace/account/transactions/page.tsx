import {AccountDate} from "@/components/account/display-preferences";
import Link from "next/link";
import {listCommercialDocumentsPage} from "@/lib/account/commercial";
import {AccountEmptyState,AccountPageHeader} from "@/components/account/account-shell";
import {humanize,Money} from "@/components/account/account-ui";
import {TransactionCardActions} from "./transaction-card-actions";
import styles from "./transactions.module.css";

export default async function Page({searchParams}:{searchParams:Promise<{cursor?:string;type?:string;q?:string;branchId?:string}>}){
 const query=await searchParams;
 const {rows,nextCursor}=await listCommercialDocumentsPage(query);
 const next=new URLSearchParams(Object.entries({...query,cursor:nextCursor}).filter((entry):entry is [string,string]=>Boolean(entry[1]))).toString();
 return <>
  <AccountPageHeader title="Sales & Purchases" subtitle="Invoices, bills, orders, notes and their current business status." action={<Link className="account-primary" href="/workspace/account/transactions/new">New document</Link>}/>
  <nav className="account-segment-nav" aria-label="Transaction areas"><Link href="/workspace/account/transactions">Documents</Link><Link href="/workspace/account/transactions/money">Receipts, payments & advances</Link></nav>
  <form method="get"><label>Search<input name="q" defaultValue={query.q}/></label><label>Document type<select name="type" defaultValue={query.type??""}><option value="">All</option>{["SALES_INVOICE","PURCHASE_BILL","SALES_ORDER","PURCHASE_ORDER","CREDIT_NOTE","DEBIT_NOTE","DELIVERY_CHALLAN","PROFORMA_INVOICE"].map(type=><option value={type} key={type}>{humanize(type)}</option>)}</select></label>{query.branchId&&<input type="hidden" name="branchId" value={query.branchId}/>}<button>Apply</button></form>
  {rows.length?<div className={styles.list}>{rows.map(x=>{const sale=x.type==="SALES_INVOICE";const bill=x.type==="PURCHASE_BILL";const base=x.payableAmount??x.grandTotal;const balance=x.status==="CANCELLED"?0:x.outstanding;const payment=x.status!=="POSTED"?undefined:x.outstanding.isZero()?"PAID":x.outstanding.eq(base)?"UNPAID":"PARTIAL";const status=(sale||bill)?`${sale?"SALE":"PURCHASE"} : ${payment??humanize(x.status)}`:humanize(x.status);const statusClass=payment==="PAID"?styles.paid:payment==="PARTIAL"?styles.partial:styles.unpaid;return <article className={styles.card} key={x.id}>
    <Link href={`/workspace/account/transactions/${x.id}`} style={{color:"inherit",textDecoration:"none"}}>
     <div className={styles.top}><div><div className={styles.party}>{x.partyName}</div><span className={`${styles.status} ${sale||bill?statusClass:""}`}>{status}</span></div><div className={styles.meta}><strong>{x.documentNumber}</strong><AccountDate value={x.issueDate.toISOString()}/></div></div>
     <div className={styles.amounts}><div className={styles.amount}><small>Total</small><strong><Money value={x.grandTotal}/></strong></div><div className={styles.amount}><small>Balance</small><strong><Money value={balance}/></strong></div></div>
    </Link>
    <TransactionCardActions id={x.id} type={x.type} number={x.documentNumber} party={x.partyName} total={x.grandTotal.toString()}/>
   </article>})}</div>:<AccountEmptyState title="No sales or purchase documents yet" detail="Create your first invoice, bill, order or note to begin." action={<Link className="account-primary" href="/workspace/account/transactions/new">Create document</Link>}/>}{nextCursor&&<Link href={`/workspace/account/transactions?${next}`}>Next page</Link>}</>;
}
