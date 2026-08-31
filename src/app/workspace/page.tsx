import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = { title: "Company dashboard" };
const links = [["▦","Dashboard","/workspace"],["♟","Employees","/workspace/employees"],["◷","Attendance","/workspace/attendance"],["⌖","GPS Route Report","/workspace/reports/gps"],["♙","Customers","/workspace/customers"],["◈","Customer Visits","/workspace/check-ins"],["◎","Leads","/workspace/leads"],["▥","Reports","/workspace/reports"],["◉","Targets","/workspace/targets"],["▣","Billing & Subscription","/workspace/billing"],["⚙","Settings","/workspace/settings"]] as const;
const employeeLinks = [["▦","Dashboard","/workspace"],["◷","Attendance","/workspace/attendance"],["♙","Customers","/workspace/customers"],["◈","Customer Visits","/workspace/check-ins"],["◎","Leads","/workspace/leads"],["▥","Reports","/workspace/reports"],["◉","Targets","/workspace/targets"]] as const;
export default async function WorkspacePage() {
 const user=await requireUser();
 if(user.role!=="COMPANY_ADMIN"||!user.companyId) return <main className="workspace-content"><p className="eyebrow">Secure workspace</p><h1>Welcome, {user.name}</h1><p className="muted">Open a role-authorized workspace area.</p><section className="report-hub">{employeeLinks.map(([,label,href])=><Link href={href} key={href}><strong>{label}</strong><span>Open {label.toLowerCase()}.</span><b>Continue →</b></Link>)}</section><form action={signOut}><button className="ghost-button">Sign out</button></form></main>;
 const start=new Date(); start.setUTCHours(0,0,0,0);
 const [company,employees,present,visits,leads,recentVisits,recentLeads]=await Promise.all([
  db.company.findUnique({where:{id:user.companyId},select:{name:true,subscriptionStatus:true,trialEndsAt:true}}),
  db.user.count({where:{companyId:user.companyId,isActive:true}}),
  db.attendance.count({where:{companyId:user.companyId,startedAt:{gte:start}}}),
  db.customerVisit.count({where:{companyId:user.companyId,checkedInAt:{gte:start}}}),
  db.lead.count({where:{companyId:user.companyId,createdAt:{gte:start}}}),
  db.customerVisit.findMany({where:{companyId:user.companyId},orderBy:{checkedInAt:"desc"},take:3,select:{checkedInAt:true,user:{select:{name:true}},customer:{select:{name:true}}}}),
  db.lead.findMany({where:{companyId:user.companyId},orderBy:{createdAt:"desc"},take:3,select:{title:true,stage:true,createdAt:true,assignedUser:{select:{name:true}}}})
 ]);
 const pct=employees?Math.round(present/employees*100):0;
 return <main className="dashboard-shell">
  <aside className="dashboard-sidebar"><BrandLogo inverse/><p>MAIN</p><nav>{links.map(([icon,label,href],i)=><Link className={i===0?"active":""} href={href} key={label}><span>{icon}</span>{label}</Link>)}</nav></aside>
  <section className="dashboard-main"><header><details className="dash-mobile-nav"><summary aria-label="Open workspace menu">☰</summary><nav>{links.map(([icon,label,href])=><Link href={href} key={label}><span>{icon}</span>{label}</Link>)}</nav></details><h1>Dashboard</h1><div className="company-switch">▣ <span>{company?.name||"Company workspace"}</span>⌄</div><div className="user-chip"><b>{user.name.charAt(0)}</b><span><strong>{user.name}</strong><small>Company Admin</small></span></div><form action={signOut}><button className="icon-button" title="Sign out">↪</button></form></header>
   <div className="dashboard-body"><div className="dashboard-welcome"><div><p>OVERVIEW</p><h2>Good day, {user.name.split(" ")[0]}!</h2><span>Here’s what’s happening with your field team today.</span></div><label>◷ <span>{start.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}</span></label></div>
   <div className="kpi-grid"><article><div><span>Employees</span><strong>{employees}</strong><small>Total active employees</small></div><i className="blue">▤</i></article><article><div><span>Present Today</span><strong>{present}</strong><small><b>{pct}%</b> attendance</small></div><i className="green">♟</i></article><article><div><span>Check-ins Today</span><strong>{visits}</strong><small>Total field visits</small></div><i className="orange">⌖</i></article><article><div><span>Leads Created</span><strong>{leads}</strong><small>Created today</small></div><i className="purple">♙</i></article></div>
   <div className="dashboard-grid"><article className="dash-card attendance-chart"><div className="card-title"><h3>Historical reports</h3><Link href="/workspace/reports">View all →</Link></div><div className="dashboard-report-links"><Link href="/workspace/reports/attendance"><strong>Attendance report</strong><span>Sessions, work duration, and route totals</span></Link><Link href="/workspace/reports/check-ins"><strong>Check-in report</strong><span>Customer visits and completion details</span></Link><Link href="/workspace/reports/leads"><strong>Lead report</strong><span>Pipeline stages, value, and conversion</span></Link></div></article>
   <article className="dash-card live-map"><div className="card-title"><h3>GPS Route Reporting <span>({present} attendance records today)</span></h3><Link href="/workspace/reports/gps">Open report →</Link></div><div className="tracking-notice"><strong>Historical, accepted GPS points</strong><p>Choose an authorized attendance session in the GPS report to inspect its recorded route. Browser tracking can contain gaps and is not a continuous live-location feed.</p><Link className="button small" href="/workspace/reports/gps">View GPS routes</Link></div></article>
   <article className="dash-card list-card"><div className="card-title"><h3>Recent Check-ins</h3><Link href="/workspace/check-ins">View all</Link></div>{recentVisits.length?recentVisits.map((v,i)=><div className="activity-row" key={i}><b>{v.user.name.charAt(0)}</b><span><strong>{v.user.name}</strong><small>{v.customer.name}</small></span><time>{v.checkedInAt.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",timeZone:"UTC"})}</time></div>):<p className="dash-empty">No check-ins yet today.</p>}</article>
   <article className="dash-card list-card"><div className="card-title"><h3>Recent Leads</h3><Link href="/workspace/leads">View all</Link></div>{recentLeads.length?recentLeads.map((l,i)=><div className="activity-row lead-row" key={i}><b>◎</b><span><strong>{l.title}</strong><small>{l.assignedUser?.name||"Unassigned"}</small></span><time>{l.stage.replaceAll("_"," ")}</time></div>):<p className="dash-empty">No leads have been created yet.</p>}</article>
   <article className="dash-card subscription"><div className="card-title"><h3>Subscription</h3><span className="active-plan">{company?.subscriptionStatus||"TRIAL"}</span></div><p>Plan: <b>SalesPunch360</b></p><p>Active seats: <b>{employees}</b></p><p>Valid till: <b>{company?.trialEndsAt?.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})||"Active"}</b></p><Link className="button small" href="/workspace/billing">View details</Link></article>
   </div></div>
  </section>
 </main>;
}
