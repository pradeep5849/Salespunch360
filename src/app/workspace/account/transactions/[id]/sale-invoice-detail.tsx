import Link from "next/link";
import styles from "./sale-invoice-detail.module.css";

type SaleLine={id:string;itemName:string|null;quantity:string;unitSymbol:string|null;rate:string;discountAmount:string;taxRate:string;taxAmount:string;lineTotal:string};
type SaleInvoiceDetailProps={
  id:string;documentNumber:string;issueDate:string;firmName:string;partyName:string;status:string;
  subtotal:string;discountTotal:string;taxTotal:string;roundOffAmount:string;grandTotal:string;received:string;balance:string;
  lines:SaleLine[];
};
const money=new Intl.NumberFormat("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const amount=(value:string)=>money.format(Number(value)||0);
export function SaleInvoiceDetail(props:SaleInvoiceDetailProps){
  const date=new Date(props.issueDate).toLocaleDateString("en-IN");
  const reversalHref=`/workspace/account/transactions/new?type=CREDIT_NOTE&sourceDocumentId=${props.id}`;
  return <main className={styles.root}>
    <header className={styles.header}>
      <Link href="/workspace/account" aria-label="Back" className={styles.back}>←</Link>
      <h1>Sale</h1>
      <a className={styles.icon} href={`/api/account/print/SALES_INVOICE/${props.id}?format=pdf`} aria-label="Share">↗</a>
      <Link className={styles.icon} href={`/workspace/account/transactions/${props.id}`} aria-label="More">⋮</Link>
    </header>
    <section className={styles.meta}>
      <div><small>Invoice No.</small><strong>{props.documentNumber}⌄</strong></div>
      <div><small>Date</small><strong>{date}⌄</strong></div>
    </section>
    <div className={styles.firm}><span>Firm Name:</span><strong>{props.firmName}</strong><span>⌄</span></div>
    <section className={styles.body}>
      <div className={styles.partyBalance}>Party Balance: <b>₹0.00</b></div>
      <div className={styles.field}><label>Customer Name *</label><div>{props.partyName}</div></div>
      <div className={styles.field}><label>Billing Name(Optional)</label><div>{props.partyName}</div></div>
      <div className={styles.billedHeader}><span>⌄　Billed Items</span><span>Rate excl. tax⌄</span></div>
      {props.lines.map((line,index)=><article className={styles.billedCard} key={line.id}>
        <div className={styles.billedTop}><span><i>#{index+1}</i><strong>{line.itemName||"Item"}</strong></span><b>₹ {amount(line.lineTotal)}</b></div>
        <div className={styles.billedGrid}>
          <span>Item Subtotal</span><span>{line.quantity} {line.unitSymbol||"Nos"} x {amount(line.rate)} = ₹ {amount(String((Number(line.quantity)||0)*(Number(line.rate)||0)))}</span>
          <span className={styles.discount}>Discount: {amount(line.discountAmount)}</span><span className={styles.discount}>₹ {amount(line.discountAmount)}</span>
          <span>Tax GST@{Number(line.taxRate)||0}%</span><span>₹ {amount(line.taxAmount)}</span>
        </div>
      </article>)}
      <section className={styles.charges}><h2>Charges</h2><div><span>☑ Round Off</span><span>₹　{amount(props.roundOffAmount)}</span></div></section>
      <section className={styles.totals}>
        <div><strong>Total Amount</strong><strong>₹　{amount(props.grandTotal)}</strong></div>
        <div><span>Received</span><b>₹ {amount(props.received)}</b></div>
        <div className={styles.balance}><strong>Balance Due</strong><strong>₹ {amount(props.balance)}</strong></div>
      </section>
    </section>
    <footer className={styles.footer}>
      <Link href={`${reversalHref}&intent=delete`} title="Posted sales are deleted through a controlled reversal">Delete</Link>
      <Link href={`${reversalHref}&intent=edit`} className={styles.edit} title="Posted sales are edited through reversal and reissue">Edit</Link>
    </footer>
  </main>;
}
