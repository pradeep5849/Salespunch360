import Link from "next/link";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
import {readBillingCart,cartSelectionSchema} from "@/lib/billing/cart";
import CartControls from "./cart-controls";
import {redirect} from "next/navigation";
export default async function Page(){
 const actor=await requirePermissionForMutation("SALES_BILLING");
 if(!actor.companyId)redirect("/workspace/billing");
 const cart=await readBillingCart(actor.companyId),parsed=cartSelectionSchema.safeParse(cart?.selection);
 if(!parsed.success)return <main className="billing-content"><h1>Shopping cart (0)</h1><section className="billing-card"><p>Your cart is empty.</p><Link href="/workspace/billing">Browse subscriptions</Link></section></main>;
 const s=parsed.data,params=new URLSearchParams();
 for(const [key,value] of Object.entries(s)){if(key==="kind"||value===undefined)continue;if(Array.isArray(value)){for(const v of value)params.append(key,v);}else params.set(key,String(value));}
 const checkout="/workspace/billing/checkout"+(s.kind==="ACCOUNT_PACKAGE"?"/account":"")+"?"+params.toString();
 return <main className="billing-content"><h1>Shopping cart (1)</h1><section className="billing-card"><h2>{s.kind==="ACCOUNT_PACKAGE"?"Account packages":s.purchaseMode==="ADD_TEAM"?"Additional users":s.purchaseMode==="ADD_ACCOUNT"?"Additional account packages":"Subscription renewal"}</h2><p>{s.billingPeriod==="YEARLY"?"1 year":"6 months"}</p>{s.kind==="ACCOUNT_PACKAGE"?<p>Packages: {s.quantity}</p>:<div className="billing-summary">{[["Admin",s.adminSeats],["Manager",s.managerSeats],["Sales",s.salesSeats],["Telecaller",s.telecallerSeats],["Account packages",s.accountPackages]].map(([label,count])=><article key={label}><strong>{count}</strong><span>{label}</span></article>)}</div>}<p>Final pricing and any proration will be recalculated at checkout.</p><Link className="button-link" href={checkout}>Proceed to checkout</Link><Link href="/workspace/billing">Edit selection</Link><CartControls remove revision={cart?.revision}/></section></main>;
}
