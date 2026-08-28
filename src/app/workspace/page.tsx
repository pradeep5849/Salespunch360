import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { getTrialStatus } from "@/lib/trial/status";
import Link from "next/link";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage() {
  const user = await requireUser();
  const company = user.role === "COMPANY_ADMIN" && user.companyId
    ? await db.company.findUnique({
        where: { id: user.companyId },
        select: { subscriptionStatus: true, trialStartedAt: true, trialEndsAt: true },
      })
    : null;
  const trial = company ? getTrialStatus(company) : null;
  return (
    <main className="workspace-shell">
      <nav><div className="logo"><span>SP</span> SalesPunch360</div><form action={signOut}><button className="ghost-button">Sign out</button></form></nav>
      <section className="workspace-content">
        <p className="eyebrow">Secure company workspace</p>
        <h1>Welcome, {user.name}</h1>
        <p className="muted">Your secure SalesPunch360 foundation is ready.</p>
        <div className="placeholder-card">
          <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div><strong>{user.email}</strong><p>{user.role.replaceAll("_", " ")}</p></div>
          <span className="status">Authenticated</span>
        </div>
        {user.role === "COMPANY_ADMIN" && <Link className="employees-link-card" href="/workspace/employees"><span>Team management</span><strong>Manage employees →</strong></Link>}
        {(user.role === "COMPANY_ADMIN" || user.role === "MANAGER" || user.role === "SALES") && <Link className="employees-link-card" href="/workspace/attendance"><span>Field work sessions</span><strong>{user.role === "COMPANY_ADMIN" ? "View attendance" : "Open attendance"} →</strong></Link>}
        {user.role === "COMPANY_ADMIN" && <Link className="employees-link-card" href="/workspace/settings"><span>Company controls</span><strong>Operational settings →</strong></Link>}
        {(user.role === "COMPANY_ADMIN" || user.role === "MANAGER" || user.role === "SALES") && <Link className="employees-link-card" href="/workspace/customers"><span>Customer directory</span><strong>{user.role === "COMPANY_ADMIN" ? "Manage customers" : "Find customers"} →</strong></Link>}
        {(user.role === "COMPANY_ADMIN" || user.role === "MANAGER" || user.role === "SALES") && <Link className="employees-link-card" href="/workspace/check-ins"><span>Field customer activity</span><strong>{user.role === "COMPANY_ADMIN" ? "View visits" : "Customer check-in"} →</strong></Link>}
        {trial?.isInTrial && (
          <section className="trial-card">
            <div><p className="eyebrow">Free Trial</p><h2>{trial.remainingDays} days remaining</h2><p className="muted">Ends {trial.trialEndsAt!.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}</p></div>
            <div className="allowances"><div><strong>{trial.managerAllowance}</strong><span>Manager allowance</span></div><div><strong>{trial.salesAllowance}</strong><span>Sales allowance</span></div></div>
          </section>
        )}
        {trial?.isTrialExpired && <section className="trial-card expired"><div><p className="eyebrow">Free Trial</p><h2>Trial expired</h2><p className="muted">Your trial ended {trial.trialEndsAt!.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}.</p></div></section>}
      </section>
    </main>
  );
}
