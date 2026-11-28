import Link from "next/link";
import {createOrderAction,createAccountPackageOrderAction} from "@/app/actions/billing";
import styles from "./cart.module.css";
import {billingQuoteForCompany} from "@/lib/mobile/billing";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
import {readBillingCart,cartSelectionSchema} from "@/lib/billing/cart";
import CartControls from "./cart-controls";
import {redirect} from "next/navigation";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const q=await searchParams;
 const actor=await requirePermissionForMutation("SALES_BILLING");
 if(!actor.companyId)redirect("/workspace/billing");
 const cart=await readBillingCart(actor.companyId),parsed=cartSelectionSchema.safeParse(cart?.selection);
 if(!parsed.success)return <main className="billing-content"><h1>Shopping cart (0)</h1><section className="billing-card"><p>Your cart is empty.</p><Link href="/workspace/billing">Browse subscriptions</Link></section></main>;
 const s=parsed.data;
 let total:number|null=null;
 try{total=Number((await billingQuoteForCompany(actor.companyId,s)).totalAmount);}catch{total=null;}
 return <main className={`billing-content ${styles.page}`}>
 <header><Link href="/workspace/billing">← Billing & subscriptions</Link><h1>Shopping cart</h1>{q.conflict==="1"&&<p role="alert">A different unpaid order exists. Check its payment status in Payment History before continuing. <Link href="/workspace/billing/history">Payment History</Link></p>}<p className="muted">Review your selection before payment.</p></header>
 <div className={styles.layout}>
 <section className={`billing-card ${styles.panel}`}>
 <div className={styles.heading}><div><p className="eyebrow">Subscription · 1 selection</p><h2>{s.kind==="ACCOUNT_PACKAGE"?"Account packages":s.purchaseMode==="ADD_TEAM"?"Additional users":s.purchaseMode==="ADD_ACCOUNT"?"Additional account packages":"Subscription renewal"}</h2></div><span className={styles.period}>{s.billingPeriod==="YEARLY"?"12 months":"6 months"}</span></div>
 <CartControls key={cart?.revision} edit selection={s} revision={cart?.revision}/>
 <div className={styles.footer}><Link href="/workspace/billing">Change plan</Link><CartControls remove revision={cart?.revision}/></div>
 </section>
 <aside className={`billing-card ${styles.panel}`}><h2>Order summary</h2><div className={styles.line}><span>Billing period</span><strong>{s.billingPeriod==="YEARLY"?"12 months":"6 months"}</strong></div>
 {total!==null?<><div className={styles.total}><span>Estimated total</span><strong>{new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(total)}</strong></div><p className="muted">Final pricing and proration are confirmed at checkout.</p><form action={s.kind==="ACCOUNT_PACKAGE"?createAccountPackageOrderAction:createOrderAction}><input type="hidden" name="cartRevision" value={cart?.revision}/><button type="submit" data-cart-checkout className={`button-link ${styles.checkout}`}>Proceed to Payment</button></form></>:<p role="status">Pricing unavailable. Update your selection before checkout.</p>}
 <p className={styles.note}>Secure online payment via Cashfree</p></aside>
 </div></main>;
}
