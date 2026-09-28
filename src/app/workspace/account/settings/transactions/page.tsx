import Link from "next/link";
import { AccountCard, AccountPageHeader } from "@/components/account/account-shell";
import { getAccountSettings } from "@/lib/account/settings";

export default async function Page(){
  const settings=await getAccountSettings(),defaults=settings?.transactionDefaults as {defaultDueDays?:number;salesTerms?:string;purchaseTerms?:string}|null;
  return <><AccountPageHeader title="Transaction Settings" subtitle="Only settings with authoritative persistence and runtime support are shown." backHref="/workspace/account"/><div className="account-settings"><AccountCard><h2>Due dates and payment terms</h2><p>Default due days: <strong>{defaults?.defaultDueDays??0}</strong></p><p>Sales terms: {defaults?.salesTerms||"Not configured"}</p><p>Purchase terms: {defaults?.purchaseTerms||"Not configured"}</p><Link href="/workspace/account/settings">Edit persisted defaults →</Link></AccountCard><AccountCard><h2>Tax and GST</h2><p>Default tax mode: <strong>{settings?.defaultTaxMode??"EXCLUSIVE"}</strong></p><p>Reverse charge and state of supply remain transaction-level controls in the existing editor.</p><Link href="/workspace/account/tax/settings">Open GST settings →</Link></AccountCard><AccountCard><h2>Document configuration</h2><nav className="account-inline-actions"><Link href="/workspace/account/settings/custom-fields">Additional fields</Link><Link href="/workspace/account/settings/print-templates">Print templates</Link></nav></AccountCard></div></>;
}
