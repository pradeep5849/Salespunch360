import Link from "next/link";
import { AccountPageHeader } from "@/components/account/account-shell";
import { updateTransactionSettingsAction } from "@/app/actions/account-settings";
import { db } from "@/lib/db";
import { getTransactionSettingsData } from "@/lib/account/settings";
import { DEFAULT_TRANSACTION_PREFERENCES, normalizeTransactionPreferences, PREFIX_TYPES, TRANSACTION_TOGGLES } from "@/lib/account/transaction-settings";
import {SaveFeedbackForm,SaveSubmitButton} from "@/components/account/save-feedback";

export default async function TransactionSettingsPage({searchParams}:{searchParams:Promise<{branchId?:string}>}) {
  const [{settings,branches,companyId},params]=await Promise.all([getTransactionSettingsData(),searchParams]);
  const branch=branches.find(item=>item.id===params.branchId)??branches[0];
  const defaults=(settings?.transactionDefaults as Record<string,unknown>|null)??{};
  const preferences=normalizeTransactionPreferences(defaults.transactionPreferences??DEFAULT_TRANSACTION_PREFERENCES);
  const series=branch?await db.numberingSeries.findMany({where:{companyId,branchId:branch.id,seriesKey:{in:PREFIX_TYPES.map(([key])=>key)}}}):[];
  return <><AccountPageHeader title="Transaction Settings" subtitle="Transaction entry preferences and numbering" backHref="/workspace/account"/>
    <SaveFeedbackForm action={updateTransactionSettingsAction} className="transaction-settings-page">
      {branch&&<><label className="transaction-firm"><span>Firm / company branch</span><select name="branchId" defaultValue={branch.id}>{branches.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {(["Transaction Header","Items Table","Taxes, Discount & Total"] as const).map(section=><SettingsSection key={section} title={section}>{TRANSACTION_TOGGLES[section].map(([key,label])=><Toggle key={key} name={key} label={label} checked={preferences[key] as boolean}/>)}{section==="Taxes, Discount & Total"&&<div className="rounding-config"><span>Rounding mode <strong>Nearest</strong></span><label>To <input name="roundingStep" type="number" min="0.01" max="100" step="0.01" defaultValue={preferences.roundingStep}/></label></div>}</SettingsSection>)}
      <SettingsSection title="More Transaction Features">
        <label className="settings-navigation-row"><span>Share Transaction as</span><select name="shareAs" defaultValue={preferences.shareAs}><option value="ASK">Ask me Everytime</option><option value="PDF">PDF</option></select></label>
        <div className="settings-navigation-row is-disabled"><span>Passcode for edit/delete<small>Requires secure passcode support</small></span><input type="checkbox" disabled aria-label="Passcode for edit/delete unavailable"/></div>
        {TRANSACTION_TOGGLES["More Transaction Features"].map(([key,label])=><Toggle key={key} name={key} label={label} checked={preferences[key] as boolean}/>)}
        <NavigationRow label="Due Dates and Payment terms" detail={`${defaults.defaultDueDays??0} default due days`} href="/workspace/account/settings"/>
        <NavigationRow label="Set Terms & Conditions" href="/workspace/account/settings"/>
        <NavigationRow label="Additional Fields" href="/workspace/account/settings/custom-fields"/>
        <NavigationRow label="Transportation Details" href="/workspace/account/settings/custom-fields"/>
        <NavigationRow label="Additional Charges" href="/workspace/account/settings/custom-fields"/>
      </SettingsSection>
      <SettingsSection title="GST">{TRANSACTION_TOGGLES.GST.map(([key,label])=><Toggle key={key} name={key} label={label} checked={preferences[key] as boolean}/>)}<NavigationRow label="Canonical Taxes & GST settings" href="/workspace/account/tax/settings"/></SettingsSection>
      <SettingsSection title="Transaction Prefixes">{PREFIX_TYPES.map(([key,label])=><label className="prefix-row" key={key}><span>{label}</span><input name={`prefix_${key}`} maxLength={30} defaultValue={series.find(item=>item.seriesKey===key)?.prefix??""} aria-label={`${label} prefix`}/></label>)}</SettingsSection>
      <SaveSubmitButton className="account-primary transaction-settings-save">Save Transaction Settings</SaveSubmitButton></>}
      {!branch&&<p>No active branch is available for transaction numbering.</p>}
    </SaveFeedbackForm></>;
}

function SettingsSection({title,children}:{title:string;children:React.ReactNode}){return <section className="transaction-settings-section"><h2>{title}</h2><div>{children}</div></section>}
function Toggle({name,label,checked}:{name:string;label:string;checked:boolean}){return <label className="transaction-toggle"><span>{label}</span><input name={name} type="checkbox" defaultChecked={checked}/></label>}
function NavigationRow({label,detail,href}:{label:string;detail?:string;href:string}){return <Link className="settings-navigation-row" href={href}><span>{label}{detail&&<small>{detail}</small>}</span><b aria-hidden>›</b></Link>}
