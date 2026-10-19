import {invoiceShareUrl} from "@/lib/account/invoice-share";
import {ManualMessage} from "@/components/account/manual-message";
import {db} from "@/lib/db";
import {resolveTransactionMessaging} from "@/lib/account/transaction-messaging";
import {formatMoney,formatCalendarDate,resolveDisplayPreferences} from "@/lib/account/display-preferences";
import { AccountDate } from "@/components/account/display-preferences";
import Link from "next/link";
import { saleDetail } from "@/lib/account/sale-detail";
import { Money } from "@/components/account/account-ui";
import { SaleDetailActions } from "./sale-detail-actions";
import styles from "./sale-detail.module.css";

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const sale=await saleDetail(id);
  if(sale.type!=="SALES_INVOICE")throw new Error("NOT_FOUND");
  const [settings,party,company]=await Promise.all([db.accountSettings.findUnique({where:{companyId:sale.companyId}}),sale.customerId?db.customer.findFirst({where:{id:sale.customerId,companyId:sale.companyId},select:{phone:true}}):null,db.company.findUnique({where:{id:sale.companyId},select:{primaryPhone:true}})]);
  const messaging=resolveTransactionMessaging(settings?.transactionDefaults),prefs=resolveDisplayPreferences(settings);
  const message=`Hi ${sale.partyName}, invoice ${sale.documentNumber} dated ${formatCalendarDate(sale.issueDate,prefs)} totals ${formatMoney(sale.payableAmount??sale.grandTotal,prefs)}.${messaging.includeInvoiceLink&&sale.status==="POSTED"?`\n${invoiceShareUrl(sale)}`:""}`;
  const base=sale.payableAmount??sale.grandTotal;
  const {outstanding,received,paymentDiscount,advanceApplied,credits,canChange,lifecycle}=sale.paymentSummary;
  const receipts=sale.allocations.filter(row=>row.settlement.type==="CUSTOMER_RECEIPT");
  return <main className={styles.root}>
    <header className={styles.header}>
      <Link className={styles.back} href="/workspace/account" aria-label="Back">←</Link>
      <h1>Sale</h1>
      <Link className={styles.icon} href={`/api/account/print/${sale.type}/${sale.id}?format=pdf`} aria-label="Share invoice">↗</Link>
      <Link className={styles.icon} href={`/workspace/account/transactions/${sale.id}`} aria-label="More invoice details">⋮</Link>
    </header>
    <section className={styles.meta}>
      <div><small>Invoice No.</small><strong>{sale.documentNumber}⌄</strong></div>
      <div><small>Date</small><strong><AccountDate value={sale.issueDate.toISOString()}/>⌄</strong></div>
    </section>
    <div className={styles.firm}><span>Firm Name:</span>{sale.branch.name}</div>
    <section className={styles.body}>
      <div className={styles.partyBalance}>Party Balance: <b><Money value={sale.partyBalance}/></b></div>
      <div className={styles.field}><label>Customer Name *</label><strong>{sale.partyName}</strong></div>
      <div className={styles.field}><label>Billing Name (Optional)</label><strong>{sale.billingName||sale.partyName}</strong></div>
      {lifecycle!=="POSTED"&&<div className={styles.note}>Invoice status: {lifecycle}. No posted balance is due.</div>}
      <div className={styles.billedHeader}><span>⌄　Billed Items</span><span>{sale.taxMode==="INCLUSIVE"?"Rate incl. tax":"Rate excl. tax"}⌄</span></div>
      {sale.lines.map((line,index)=><article className={styles.billedCard} key={line.id}>
        <div className={styles.lineTop}><div className={styles.lineTitle}><span className={styles.lineNo}>#{index+1}</span><strong>{line.itemName}</strong></div><b><Money value={line.lineTotal}/></b></div>
        {(line.itemCode||line.description||line.specification)&&<dl className={styles.lineMeta}>{line.itemCode&&<><dt>Item code</dt><dd>{line.itemCode}</dd></>}{line.description&&<><dt>Description</dt><dd style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{line.description}</dd></>}{line.specification&&<><dt>Specification</dt><dd style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{line.specification}</dd></>}</dl>}
        <div className={styles.lineMeta}>
          <span>Item Subtotal</span><span>{line.quantity.toString()} {line.unitSymbol??"Nos"} × <Money value={line.rate}/> = <Money value={line.baseAmount}/></span>
          <span className={styles.orange}>Discount</span><span className={styles.orange}><Money value={line.discountAmount}/></span>
          <span>Tax GST@{line.taxRate.toString()}%</span><span><Money value={line.taxAmount}/></span>
          {!line.cessAmount.isZero()&&<><span>Cess @{line.cessRate.toString()}%</span><span><Money value={line.cessAmount}/></span></>}
        </div>
      </article>)}
      <section className={styles.charges}><h2>Charges</h2>{!sale.freightAmount.isZero()&&<div className={styles.round}><span>Freight</span><Money value={sale.freightAmount}/></div>}{!sale.otherChargesAmount.isZero()&&<div className={styles.round}><span>Other charges</span><Money value={sale.otherChargesAmount}/></div>}<div className={styles.round}><span>{sale.roundOffAmount.isZero()?"☐":"☑"} Round Off</span><strong><Money value={sale.roundOffAmount}/></strong></div></section>
      <section className={styles.totals}>
        <div className={styles.totalRow}><span>Total Amount</span><strong><Money value={base}/></strong></div>
        {sale.reverseCharge&&<div className={styles.totalRow}><span>GST payable by recipient (reverse charge)</span><Money value={sale.taxTotal}/></div>}
        <div className={`${styles.totalRow} ${styles.received}`}><span>Received</span><strong><Money value={received}/></strong></div>
        {Number(paymentDiscount)!==0&&<div className={styles.totalRow}><span>Payment discount</span><Money value={paymentDiscount}/></div>}
        {Number(advanceApplied)!==0&&<div className={styles.totalRow}><span>Advance applied</span><Money value={advanceApplied}/></div>}
        {Number(credits)!==0&&<div className={styles.totalRow}><span>Credit adjustments</span><Money value={credits}/></div>}
        <div className={`${styles.totalRow} ${styles.balance}`}><span>Balance Due</span><strong><Money value={outstanding}/></strong></div>
        {!canChange&&sale.status==="POSTED"&&<div className={styles.note}>This posted Sale has payment or adjustment history. Use its correction workflow to retain that history.</div>}
      </section>
      {receipts.map(row=><div className={styles.field} key={row.id}><label>Payment Type / Payment Ref No.</label><strong>{row.settlement.paymentMode}{row.settlement.reference?` · ${row.settlement.reference}`:""}</strong></div>)}
      {sale.stateOfSupplyCode&&<div className={styles.field}><label>State of Supply</label><strong>{sale.stateOfSupplyName}</strong></div>}
      {sale.dueDate&&<div className={styles.field}><label>Due date</label><AccountDate value={sale.dueDate.toISOString()}/></div>}
      {sale.projectReference&&<div className={styles.field}><label>Project reference</label><strong>{sale.projectReference}</strong></div>}
      {sale.paymentTerms&&<div className={styles.field}><label>Payment terms</label><p style={{whiteSpace:"pre-wrap"}}>{sale.paymentTerms}</p></div>}
      {sale.customerPoNumber&&<div className={styles.field}><label>Purchase order number</label><strong>{sale.customerPoNumber}</strong>{sale.customerPoDate&&<AccountDate value={sale.customerPoDate.toISOString()}/>}</div>}
      {sale.ewayBillNumber&&<div className={styles.field}><label>E-way bill number</label><strong>{sale.ewayBillNumber}</strong></div>}
      {sale.transactionTime&&<div className={styles.field}><label>Transaction time</label><strong>{sale.transactionTime}</strong></div>}
      {sale.shippingAddress&&<div className={styles.field}><label>Shipping Address</label><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{sale.shippingAddress}</p></div>}
      {sale.notes&&<div className={styles.field}><label>Terms & Conditions / Description</label><p style={{whiteSpace:"pre-wrap"}}>{sale.notes}</p></div>}
    </section>
    {(messaging.sendToParty||messaging.copyToSelf)&&<section className={styles.body}>{messaging.sendToParty&&<ManualMessage message={message} phone={party?.phone}/ >}{messaging.copyToSelf&&<><h3>Copy to Self</h3><ManualMessage message={message} phone={company?.primaryPhone}/></>}{messaging.includeInvoiceLink&&<p><Link href={`/api/account/print/${sale.type}/${sale.id}?format=pdf`}>Download invoice to attach</Link></p>}</section>}
    <SaleDetailActions id={sale.id} canChange={canChange}/>
  </main>;
}
