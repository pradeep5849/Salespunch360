import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = { title: "Company dashboard" };
const links = [["▦","Dashboard","/workspace"],["♟","Employees","/workspace/employees"],["◷","Attendance","/workspace/attendance"],["⌖","Live Tracking","/workspace/reports/gps"],["♙","Customers & Visits","/workspace/customers"],["◎","Leads","/workspace/leads"],["▥","Reports","/workspace/reports"],["◉","Targets","/workspace/targets"],["▣","Billing & Subscription","/workspace/billing"],["⚙","Settings","/workspace/settings"]];
export default async function WorkspacePage() {
 const user=await requireUser();
 if(user.role!=="COMPANY_ADMIN"||!user.companyId) return <main className="workspace-content"><p className="eyebrow">Secure workspace</p><h1>Welcome, {user.name}</h1><p className="muted">Your role workspace remains available from the navigation.</p></main>;
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
   <div className="dashboard-grid"><article className="dash-card attendance-chart"><div className="card-title"><h3>Attendance Overview</h3><select aria-label="Attendance period"><option>This week</option></select></div><div className="chart"><div className="ylabels"><span>25</span><span>20</span><span>15</span><span>10</span><span>5</span><span>0</span></div><svg viewBox="0 0 600 210" preserveAspectRatio="none"><g><path d="M0 35H600M0 70H600M0 105H600M0 140H600M0 175H600"/><polyline className="present" points="0,160 100,125 200,140 300,65 400,115 500,45 600,75"/><polyline className="absent" points="0,183 100,180 200,160 300,178 400,145 500,175 600,165"/></g></svg><div className="xlabels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div className="legend"><span className="lg-green">Present</span><span className="lg-red">Absent</span></div></div></article>
   <article className="dash-card live-map"><div className="card-title"><h3>Live Tracking <span>({present} employees)</span></h3><Link href="/workspace/reports/gps">View map →</Link></div><div className="map-placeholder"><svg viewBox="0 0 500 270"><path className="roads" d="M0 70L500 210M20 250L210 0M90 0L280 270M0 160L500 50M340 0L490 260"/><path className="route" d="M55 205L120 150L195 175L260 100L355 135L440 60"/></svg>{["one","two","three","four","five"].map((x,i)=><i className={`map-user ${x}`} key={x}>{i+1}</i>)}</div></article>
   <article className="dash-card list-card"><div className="card-title"><h3>Recent Check-ins</h3><Link href="/workspace/check-ins">View all</Link></div>{recentVisits.length?recentVisits.map((v,i)=><div className="activity-row" key={i}><b>{v.user.name.charAt(0)}</b><span><strong>{v.user.name}</strong><small>{v.customer.name}</small></span><time>{v.checkedInAt.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",timeZone:"UTC"})}</time></div>):<p className="dash-empty">No check-ins yet today.</p>}</article>
   <article className="dash-card list-card"><div className="card-title"><h3>Recent Leads</h3><Link href="/workspace/leads">View all</Link></div>{recentLeads.length?recentLeads.map((l,i)=><div className="activity-row lead-row" key={i}><b>◎</b><span><strong>{l.title}</strong><small>{l.assignedUser?.name||"Unassigned"}</small></span><time>{l.stage.replaceAll("_"," ")}</time></div>):<p className="dash-empty">No leads have been created yet.</p>}</article>
   <article className="dash-card subscription"><div className="card-title"><h3>Subscription</h3><span className="active-plan">{company?.subscriptionStatus||"TRIAL"}</span></div><p>Plan: <b>SalesPunch360</b></p><p>Active seats: <b>{employees}</b></p><p>Valid till: <b>{company?.trialEndsAt?.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})||"Active"}</b></p><Link className="button small" href="/workspace/billing">View details</Link></article>
   </div></div>
  </section>
 </main>;
}
