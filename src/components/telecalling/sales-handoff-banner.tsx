import Link from "next/link";
import {listSalesActions} from "@/lib/telecalling/service";
import {changeSalesAction} from "@/app/actions/telecalling";

export async function SalesHandoffBanner(){
 let actions:Awaited<ReturnType<typeof listSalesActions>>=[];
 try{actions=(await listSalesActions()).filter(a=>a.status!=="ACTION_TAKEN").slice(0,3);}catch{return null;}
 if(!actions.length)return null;
 return <section className="mx-auto mt-3 w-[min(1180px,calc(100%-2rem))] rounded-xl border border-amber-300 bg-amber-50 p-3">
  <strong>Sales action required · {actions.length}</strong>
  <div className="mt-2 grid gap-2">{actions.map(a=><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2" key={a.id}><span><b>{a.leadTitle}</b> · {a.trigger.toLowerCase().replaceAll("_"," ")} · from {a.callerName}{a.notes?` · ${a.notes}`:""}</span><span className="flex gap-2"><Link className="rounded border px-2 py-1 text-sm" href={`/workspace/leads/${a.leadId}`}>Open Lead</Link>{a.status==="PENDING"?<form action={changeSalesAction}><input type="hidden" name="actionId" value={a.id}/><input type="hidden" name="status" value="ACKNOWLEDGED"/><button className="rounded border px-2 py-1 text-sm">Acknowledge</button></form>:<small>Acknowledged</small>}</span></div>)}</div>
 </section>;
}
