import Link from "next/link";
import {notFound} from "next/navigation";
import {z} from "zod";
import {db} from "@/lib/db";
import {requirePermission} from "@/lib/auth/authorization";
import {AccountDate} from "@/components/account/display-preferences";
import {Money} from "@/components/account/account-ui";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const actor=await requirePermission("ACCOUNT_LEDGER_VIEW");
 const parsed=z.string().guid().safeParse((await params).id);if(!parsed.success||!actor.companyId)notFound();
 const row=await db.journalEntry.findFirst({where:{id:parsed.data,companyId:actor.companyId,...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{})},include:{lines:{include:{ledgerAccount:true,costCentre:true},orderBy:[{lineNumber:"asc"},{id:"asc"}]}}});
 if(!row)notFound();
 return <main className="account-content"><h1>Journal {row.journalNumber}</h1><p>{row.status} · <AccountDate value={row.entryDate.toISOString()}/></p><p>{row.reference}</p><p>{row.narration}</p><table><thead><tr><th>Ledger</th><th>Cost centre</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{row.lines.map(line=><tr key={line.id}><td>{line.ledgerAccount.code} · {line.ledgerAccount.name}</td><td>{line.costCentre?.name??"—"}</td><td>{line.description}</td><td><Money value={line.debit.toString()}/></td><td><Money value={line.credit.toString()}/></td></tr>)}</tbody></table><Link href="/workspace/account/accounting/journals">Back to journals</Link></main>;
}
