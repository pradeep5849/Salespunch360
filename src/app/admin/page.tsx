import Link from "next/link";
import { requireGlobalSuperAdmin } from "@/lib/auth/authorization";
import { getAdminDashboard } from "@/lib/admin/dashboard";

const date = (value: Date | null) => value ? value.toLocaleDateString() : "—";
export default async function AdminDashboardPage() {
  await requireGlobalSuperAdmin();
  const { counts, recentCompanies } = await getAdminDashboard();
  const cards = [["Total Companies", counts.total], ["Trial Companies", counts.TRIAL], ["Active Companies", counts.ACTIVE], ["Expired Companies", counts.EXPIRED], ["Suspended Companies", counts.SUSPENDED]] as const;
  return <main className="admin-content">
    <div className="admin-title-row"><div><p className="eyebrow">Platform administration</p><h1>Dashboard</h1><p className="muted">A safe operational overview of registered Companies.</p></div><div className="admin-actions"><Link href="/admin/companies">View Companies</Link><Link href="/admin/billing">Billing &amp; Pricing</Link></div></div>
    <section className="admin-summary" aria-label="Company status summary">{cards.map(([label, count]) => <article key={label}><span>{label}</span><strong>{count}</strong></article>)}</section>
    <section className="admin-panel"><div className="admin-section-heading"><div><p className="eyebrow">Recent Companies</p><h2>Latest registrations</h2></div><Link href="/admin/companies">View all</Link></div>
      {recentCompanies.length === 0 ? <p className="muted">No Companies are registered.</p> : <div className="admin-company-list">{recentCompanies.map(company => <article key={company.id}><div><strong>{company.name}</strong><span>{company.productEdition}</span></div><div><span className={`admin-status status-${company.subscriptionStatus.toLowerCase()}`}>{company.subscriptionStatus}</span><small>Trial end {date(company.trialEndsAt)}</small><small>Created {date(company.createdAt)}</small></div></article>)}</div>}
    </section>
  </main>;
}
