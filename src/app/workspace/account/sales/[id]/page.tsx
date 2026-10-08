import Link from "next/link";
import { getCommercialDocument } from "@/lib/account/commercial";
import { Money } from "@/components/account/account-ui";
import { SaleDetailActions } from "./sale-detail-actions";
import styles from "./sale-detail.module.css";

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const sale=await getCommercialDocument(id);
  if(sale.type!=="SALES_INVOICE")throw new Error("NOT_FOUND");
  const base=sale.payableAmount??sale.grandTotal;
  const outstanding=sale.financial?.outstanding??base;
  const received=base.sub(outstanding);
  const canChange=sale.status==="POSTED"&&Boolean(sale.financial)&&outstanding.eq(base)&&sale.adjustments.length===0&&sale.allocations.length===0&&sale.advanceApplications.length===0;
  return <main className={styles.root}>
    <header className={styles.header}>
      <Link className={styles.back} href="/workspace/account" aria-label="Back">←</Link>
      <h1>Sale</h1>
      <Link className={styles.icon} href={`/api/account/print/${sale.type}/${sale.id}?format=pdf`} aria-label="Share invoice">↗</Link>
      <Link className={styles.icon} href={`/workspace/account/transactions/${sale.id}`} aria-label="More invoice details">⋮</Link>
    </header>
    <section className={styles.meta}>
      <div><small>Invoice No.</small><strong>{sale.documentNumber}⌄</strong></div>
      <div><small>Date</small><strong>{sale.issueDate.toLocaleDateString("en-IN")}⌄</strong></div>
    </section>
    <div className={styles.firm}><span>Firm Name:</span>{sale.branch.name}</div>
    <section className={styles.body}>
      <div className={styles.partyBalance}>Party Balance: <b><Money value={outstanding}/></b></div>
      <div className={styles.field}><label>Customer Name *</label><strong>{sale.partyName}</strong></div>
      <div className={styles.field}><label>Billing Name (Optional)</label><strong>{sale.partyName}</strong></div>
      <div className={styles.billedHeader}><span>⌄　Billed Items</span><span>Rate excl. tax⌄</span></div>
      {sale.lines.map((line,index)=><article className={styles.billedCard} key={line.id}>
        <div className={styles.lineTop}><div className={styles.lineTitle}><span className={styles.lineNo}>#{index+1}</span><strong>{line.itemName}</strong></div><b><Money value={line.lineTotal}/></b></div>
        <div className={styles.lineMeta}>
          <span>Item Subtotal</span><span>{line.quantity.toString()} {line.unitSymbol??"Nos"} × {line.rate.toString()} = {line.baseAmount.toString()}</span>
          <span className={styles.orange}>Discount</span><span className={styles.orange}>{line.discountAmount.toString()}</span>
          <span>Tax GST@{line.taxRate.toString()}%</span><span>{line.taxAmount.toString()}</span>
        </div>
      </article>)}
      <section className={styles.charges}><h2>Charges</h2><div className={styles.round}><span>☑ Round Off</span><strong>{sale.roundOffAmount.toString()}</strong></div></section>
      <section className={styles.totals}>
        <div className={styles.totalRow}><span>Total Amount</span><strong><Money value={sale.grandTotal}/></strong></div>
        <div className={`${styles.totalRow} ${styles.received}`}><span>Received</span><strong><Money value={received}/></strong></div>
        <div className={`${styles.totalRow} ${styles.balance}`}><span>Balance Due</span><strong><Money value={outstanding}/></strong></div>
        {!canChange&&sale.status==="POSTED"&&<div className={styles.note}>This Sale has a payment, advance or adjustment. Reverse those first before Edit/Delete so accounts and stock remain correct.</div>}
      </section>
    </section>
    <SaleDetailActions id={sale.id} canChange={canChange}/>
  </main>;
}
