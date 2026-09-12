import Link from "next/link";
import type { AccountNavGroup } from "@/lib/account/navigation";
import { selectAccountBranch, switchWorkspace } from "@/app/actions/workspace-context";
import { AccountBottomNav, type AccountBottomItem } from "./account-bottom-nav";
import { AccountIcon } from "./account-icons";

type ShellProps={children:React.ReactNode;companyName:string;branchContext:string;branchContextValue:string;branches:{id:string;name:string}[];canConsolidate:boolean;canSwitchWorkspace:boolean;userName:string;role:string;notifications:number;navigation:AccountNavGroup[];showItems:boolean;showProjects:boolean};
export function AccountShell({children,companyName,branchContext,branchContextValue,branches,canConsolidate,canSwitchWorkspace,userName,role,notifications,navigation,showItems,showProjects}:ShellProps){
 const bottom:AccountBottomItem[]=[{label:"Home",href:"/workspace/account",icon:"home"},{label:"Dashboard",href:"/workspace/account/dashboard",icon:"dashboard"},...(showItems?[{label:"Items",href:"/workspace/account/inventory",icon:"items"} as const]:[]),...(showProjects?[{label:"Projects",href:"/workspace/account/projects",icon:"projects"} as const]:[]),{label:"Menu",href:"/workspace/account/menu",icon:"menu"}];
 const canSelect=branches.length>1||canConsolidate;
 return <div className="account-shell"><header className="account-topbar"><Link href="/workspace/account" className="account-identity"><strong>{companyName}</strong><small>{branchContext}</small></Link><div className="account-top-actions">
  {canSwitchWorkspace&&<form action={switchWorkspace}><input type="hidden" name="workspace" value="SALES"/><button className="account-context-button">Sales</button></form>}
  {canSelect?<form action={selectAccountBranch}><label className="account-context-select"><span className="sr-only">Account Branch</span><select name="context" defaultValue={branchContextValue}>{canConsolidate&&<option value="all">Company Consolidated</option>}{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><button>View</button></label></form>:<small className="account-fixed-branch">{branchContext}</small>}
  <Link aria-label={`${notifications} account notifications`} className="account-icon-button" href="/workspace/account/notifications"><AccountIcon name="bell"/>{notifications>0&&<b>{notifications>99?"99+":notifications}</b>}</Link><details className="account-profile"><summary aria-label="Open profile menu"><span>{userName.charAt(0).toUpperCase()}</span></summary><div><strong>{userName}</strong><small>{role.replaceAll("_"," ").toLowerCase()}</small><small>{branchContext}</small><Link href="/workspace/change-password">Profile & password</Link><form action="/api/auth/sign-out" method="post"><button>Sign out</button></form></div></details></div></header>
  <div className="account-desktop-nav" aria-label="Account modules">{navigation.map(group=><Link key={group.label} href={`/workspace/account/menu#${group.label.toLowerCase()}`}>{group.label}</Link>)}</div><main className="account-main">{children}</main><AccountBottomNav items={bottom}/></div>;
}
export function AccountPageHeader({title,subtitle,action}:{title:string;subtitle?:string;action?:React.ReactNode}){return <header className="account-page-header"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>}
export function AccountCard({children,className=""}:{children:React.ReactNode;className?:string}){return <section className={`account-card ${className}`}>{children}</section>}
export function AccountEmptyState({title,detail,action}:{title:string;detail:string;action?:React.ReactNode}){return <div className="account-empty"><strong>{title}</strong><p>{detail}</p>{action}</div>}
