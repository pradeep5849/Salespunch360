import {randomUUID} from "node:crypto";
import {canUsePermission} from "@/lib/auth/permissions";
import {PartyTransferReversalForm} from "@/components/account/party-transfer-reversal-form";
import {ClientMoney,AccountDate} from "@/components/account/display-preferences";
import Link from "next/link";
import {requirePermission,AuthorizationError} from "@/lib/auth/authorization";
import {partyTransferForActor} from "@/lib/account/party-transfers";
import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const actor=await requirePermission("ACCOUNT_MONEY_VIEW");if(!actor.companyId)throw new AuthorizationError();
 const row=await partyTransferForActor({...actor,companyId:actor.companyId},(await params).id);
 const canReverse=actor.accountRole==="ACCOUNT_ADMIN"&&canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_MONEY_ENTRY")&&canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_POST"),today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title={`Party Transfer ${row.number}`} backHref="/workspace/account/money/party-transfers"/><dl><dt>Status</dt><dd>{row.status}</dd><dt>Date</dt><dd><AccountDate value={row.transactionDate}/></dd><dt>Received from</dt><dd>{row.receivedPartyName}</dd><dt>Received amount</dt><dd><ClientMoney value={row.receivedAmount}/></dd><dt>Paid to</dt><dd>{row.paidPartyName}</dd><dt>Paid amount</dt><dd><ClientMoney value={row.paidAmount}/></dd><dt>Pass-through amount</dt><dd><ClientMoney value={row.passThroughAmount}/></dd><dt>Commission — Other Income</dt><dd><ClientMoney value={row.commissionAmount}/></dd><dt>Note</dt><dd style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{row.notes||"—"}</dd></dl>{row.photoObjectKey&&<p><a href={`/api/account/party-transfers/${row.id}/photo`} target="_blank" rel="noreferrer">View image</a></p>}{canReverse&&row.status==="POSTED"&&<PartyTransferReversalForm id={row.id} requestKey={randomUUID()} today={today}/>}<Link href="/workspace/account/money/party-transfers">Add another transfer</Link></section></main>;
}
