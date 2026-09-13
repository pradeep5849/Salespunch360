import Link from "next/link";
import { accountNavSectionId, type AccountNavGroup } from "@/lib/account/navigation";
import { AccountBottomNav, type AccountBottomItem } from "./account-bottom-nav";
import { AccountIcon } from "./account-icons";
import { AccountProfileMenu } from "./account-profile-menu";
import {CompanyIdentity} from "@/components/workspace/company-identity";

type ShellProps={children:React.ReactNode;companyName:string;companyAddress?:string;hasCompanyLogo?:boolean;companyLogoVersion?:number;userName:string;role:string;notifications:number;navigation:AccountNavGroup[];showItems:boolean;showProjects:boolean};
export function AccountShell({children,companyName,companyAddress,hasCompanyLogo=false,companyLogoVersion,userName,role,notifications,navigation,showItems,showProjects}:ShellProps){
 const bottom:AccountBottomItem[]=[{label:"Home",href:"/workspace/account",icon:"home"},{label:"Dashboard",href:"/workspace/account/dashboard",icon:"dashboard"},...(showItems?[{label:"Items",href:"/workspace/account/inventory",icon:"items"} as const]:[]),...(showProjects?[{label:"Projects",href:"/workspace/account/projects",icon:"projects"} as const]:[]),{label:"Menu",href:"/workspace/account/menu",icon:"menu"}];
 return <div className="account-shell"><header className="account-topbar"><CompanyIdentity href="/workspace/account" name={companyName} address={companyAddress} hasLogo={hasCompanyLogo} version={companyLogoVersion} className="account-identity workspace-identity"/><div className="account-top-actions">
  <Link aria-label={`${notifications} account notifications`} className="account-icon-button" href="/workspace/account/notifications"><AccountIcon name="bell"/>{notifications>0&&<b>{notifications>99?"99+":notifications}</b>}</Link><AccountProfileMenu userName={userName} role={role}/></div></header>
  <div className="account-desktop-nav" aria-label="Account modules">{navigation.map(group=><Link key={group.label} href={`/workspace/account/menu#${accountNavSectionId(group.label)}`}>{group.label}</Link>)}</div><main className="account-main">{children}</main><AccountBottomNav items={bottom}/></div>;
}
export function AccountPageHeader({title,subtitle,action,backHref}:{title:string;subtitle?:string;action?:React.ReactNode;backHref?:string}){return <header className="account-page-header"><div>{backHref&&<Link className="account-page-back" href={backHref} aria-label={`Back from ${title}`}>←</Link>}<h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action&&<div className="account-page-action">{action}</div>}</header>}
export function AccountCard({children,className=""}:{children:React.ReactNode;className?:string}){return <section className={`account-card ${className}`}>{children}</section>}
export function AccountEmptyState({title,detail,action}:{title:string;detail:string;action?:React.ReactNode}){return <div className="account-empty"><span className="account-empty-icon" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16v12H4zM8 7V5h8v2M8 12h8"/></svg></span><strong>{title}</strong><p>{detail}</p>{action}</div>}
