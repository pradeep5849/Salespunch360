import Link from "next/link";
import {requirePermission} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {orderStateForActor} from "@/lib/account/orders/lifecycle";
import {closeRemainingOrderAction} from "@/app/actions/commercial";
import {ActionFeedbackForm} from "./action-feedback-form";
export async function OrderProgress({id}:{id:string}){
 const actor=await requirePermission("ACCOUNT_LEDGER_VIEW");
 const state=await orderStateForActor(actor as Parameters<typeof orderStateForActor>[0],id);
 const editable=canUsePermission(actor,"SALESPUNCH360_ACCOUNT",state.type==="SALES_ORDER"?"ACCOUNT_SALES_ENTRY":"ACCOUNT_PURCHASE_ENTRY");
 return <section className="account-card" aria-label="Order fulfilment"><h2>Order fulfilment</h2><p>Status: {state.status} · {state.reason.replaceAll("_"," ")}</p>{state.note&&<p>{state.note}</p>}{state.type==="SALES_ORDER"&&state.status==="OPEN"&&state.canClose&&canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_POST")&&<Link className="account-primary" href={`/workspace/account/transactions/new?type=SALES_INVOICE&orderId=${id}`}>Create Sale from remaining order</Link>}{state.lines.length>0&&<div className="table-wrap" role="region" aria-label="Order quantities in primary units" tabIndex={0}><table><thead><tr><th>Line</th><th>Ordered</th><th>Invoiced / billed</th><th>Remaining</th></tr></thead><tbody>{state.lines.map(line=><tr key={line.id}><td>{line.itemName}</td><td>{line.ordered}</td><td>{line.fulfilled}</td><td>{line.remaining}</td></tr>)}</tbody></table></div>}{editable&&state.documentStatus==="POSTED"&&state.status!=="CLOSED"&&<ActionFeedbackForm action={closeRemainingOrderAction}><input type="hidden" name="id" value={id}/><label>Reason for closing remaining order<textarea name="reason" required maxLength={1000}/></label><p>Closes the remaining commitment. No invoice, payment or journal is created.</p><button type="submit">Close remaining order</button></ActionFeedbackForm>}</section>;
}
