import Link from "next/link";
import {requirePermission,AuthorizationError} from "@/lib/auth/authorization";
import {partyTransferForActor} from "@/lib/account/party-transfers";
import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
export default async function Page({params}:{params:Promise<{id:string}>}){
 const actor=await requirePermission("ACCOUNT_MONEY_VIEW");if(!actor.companyId)throw new AuthorizationError();
 const row=await partyTransferForActor({...actor,companyId:actor.companyId},(await params).id);
 return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title={`Party Transfer ${row.number}`} backHref="/workspace/account/money/party-transfers"/><dl><dt>Date</dt><dd>{row.transactionDate}</dd><dt>Received from</dt><dd>{row.receivedPartyName}</dd><dt>Received amount</dt><dd>{row.receivedAmount}</dd><dt>Paid to</dt><dd>{row.paidPartyName}</dd><dt>Paid amount</dt><dd>{row.paidAmount}</dd><dt>Pass-through amount</dt><dd>{row.passThroughAmount}</dd><dt>Commission — Other Income</dt><dd>{row.commissionAmount}</dd><dt>Note</dt><dd style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{row.notes||"—"}</dd></dl>{row.photoObjectKey&&<p><a href={`/api/account/party-transfers/${row.id}/photo`} target="_blank" rel="noreferrer">View image</a></p>}<Link href="/workspace/account/money/party-transfers">Add another transfer</Link></section></main>;
}
