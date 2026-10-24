import {randomUUID} from "node:crypto";
import {requirePermission,AuthorizationError} from "@/lib/auth/authorization";
import {partyTransferOptionsForActor} from "@/lib/account/party-transfers";
import {PartyTransferForm} from "@/components/account/party-transfer-form";
import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";
export default async function Page(){
 const actor=await requirePermission("ACCOUNT_MONEY_VIEW");if(!actor.companyId)throw new AuthorizationError();
 const options=await partyTransferOptionsForActor({...actor,companyId:actor.companyId}),today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title="Party To Party Transfer" backHref="/workspace/account"/>{options.canPost?<PartyTransferForm options={options} requestKey={randomUUID()} today={today}/>:<p>You need Money Entry and Journal Post permissions to save a transfer.</p>}</section></main>;
}
