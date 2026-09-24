import {WorkspacePageHeader} from '@/components/workspace/workspace-page-header';
import {dateText,loadBillingPageData} from '../billing-page-data';

const summaryStyle={display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(118px,1fr))',gap:8} as const;
const tileStyle={padding:'10px 12px',border:'1px solid var(--line)',borderRadius:10,display:'grid',gap:3,minHeight:62} as const;
const Tile=({value,label}:{value:string;label:string})=><article style={tileStyle}><strong>{value}</strong><span style={{fontSize:12,color:'var(--muted)'}}>{label}</span></article>;

export default async function Page(){
 const {r,e,telecaller,managersEnabled,accountCurrent,salesStatus,accountStatus}=await loadBillingPageData();
 return <main className="billing-content"><WorkspacePageHeader title="Subscription" backHref="/workspace/billing"/>
  {r.hasSales&&e&&<section className="billing-card"><h2>Sales Subscription</h2><div style={summaryStyle}><Tile value={salesStatus} label="Status"/><Tile value={dateText(e.subscription?.endsAt??r.company?.trialEndsAt)} label="Common renewal / expiry"/><Tile value={`${e.adminUsage} / ${e.adminLimit}`} label="Additional Admin"/>{managersEnabled&&<Tile value={`${e.managerUsage} / ${e.managerLimit}`} label="Manager"/>}<Tile value={`${e.salesUsage} / ${e.salesLimit}`} label="Sales"/>{telecaller&&<Tile value={`${telecaller.used} / ${telecaller.limit}`} label="Telecaller"/>}</div><p className="muted">Sales Admin, Manager, Sales and Telecaller seats share one Sales subscription expiry.</p></section>}
  {r.hasAccount&&<section className="billing-card"><h2>Account Subscription</h2><div style={summaryStyle}><Tile value={accountStatus} label="Status"/><Tile value={dateText(accountCurrent?.endsAt??(accountStatus==='TRIAL'?r.company?.trialEndsAt:null))} label="Valid until / renewal"/><Tile value={`${r.account.packageCount}`} label="Account packages"/><Tile value={`${r.account.usage.ACCOUNT_ADMIN} / ${r.account.limits.ACCOUNT_ADMIN}`} label="Account Admin"/><Tile value={`${r.account.usage.ACCOUNTANT} / ${r.account.limits.ACCOUNTANT}`} label="Accountant"/><Tile value={`${r.account.usage.PROJECT_MANAGER} / ${r.account.limits.PROJECT_MANAGER}`} label="Project Manager"/><Tile value={`${r.account.usage.DATA_ENTRY} / ${r.account.limits.DATA_ENTRY}`} label="Data Entry"/></div></section>}
 </main>;
}
