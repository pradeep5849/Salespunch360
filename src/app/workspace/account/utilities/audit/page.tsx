import Link from "next/link";
import {ZodError} from "zod";
import { AccountCard, AccountEmptyState, AccountPageHeader } from "@/components/account/account-shell";
import { formatIndiaDate } from "@/lib/account/presentation";
import { requirePermission } from "@/lib/auth/authorization";
import { auditHistoryPageForActor } from "@/lib/account/audit-history";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const query=await searchParams, actor=await requirePermission("ACCOUNT_SETTINGS");
 const filters=Object.fromEntries(Object.entries(query).filter(([,value])=>value));
 let page:Awaited<ReturnType<typeof auditHistoryPageForActor>>;
 try{page=await auditHistoryPageForActor({...actor,companyId:actor.companyId!},filters);}catch(error){if(error instanceof ZodError||(error instanceof Error&&error.message==="INVALID_AUDIT_CURSOR"))return <><AccountPageHeader title="Audit history"/><p role="alert">The date, actor ID or page filter is invalid. Use valid dates and an actor UUID.</p><Link href="/workspace/account/utilities/audit">Reset filters</Link></>;throw error;}
 const {rows,nextCursor}=page;
 const next=new URLSearchParams({...filters,...(nextCursor?{cursor:nextCursor}:{})} as Record<string,string>);
 return <><AccountPageHeader title="Audit history" subtitle="Company-wide, append-only Account activity for all-branch Account Admins. Dates use the India business calendar."/>
 <form method="get"><label>From<input type="date" name="from" defaultValue={query.from}/></label><label>Through<input type="date" name="to" defaultValue={query.to}/></label><label>Event type<input name="eventType" defaultValue={query.eventType} placeholder="For example FINANCIAL_YEAR_CLOSED"/></label><label>Entity type<input name="entityType" defaultValue={query.entityType}/></label><label>Actor ID<input name="actorId" defaultValue={query.actorId}/></label><button>Filter history</button><Link href="/workspace/account/utilities/audit">Clear filters</Link></form>
 <AccountCard>{rows.length?<ol>{rows.map(row=><li key={row.id}><strong>{row.eventType.replaceAll("_"," ")}</strong><p>{row.actor.name} · {formatIndiaDate(row.createdAt)} · {row.entityType} {row.entityId}</p><details><summary>Redacted event details</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(row.metadata,null,2)}</pre></details></li>)}</ol>:<AccountEmptyState title="No matching audit events" detail="Change the filters to see other recorded activity."/>}</AccountCard>
 {nextCursor&&<Link href={`/workspace/account/utilities/audit?${next}`}>Older events</Link>}</>;
}
