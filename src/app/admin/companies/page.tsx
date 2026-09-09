import Link from "next/link";
import { getAdminCompanies } from "@/lib/admin/dashboard";
import { requireGlobalSuperAdmin } from "@/lib/auth/authorization";

const date = (value: Date | null) => value ? value.toLocaleDateString() : "—";
export default async function AdminCompaniesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requireGlobalSuperAdmin();
  const [companies, query] = await Promise.all([getAdminCompanies(), searchParams]);
  return <main className="admin-content">
    {query.deleted === "1" && <p className="success-alert" role="status">Company permanently deleted.</p>}
    <div className="admin-title-row"><div><p className="eyebrow">Platform administration</p><h1>Companies</h1><p className="muted">Registered tenant identity and subscription status.</p></div><Link className="admin-primary-action" href="/admin/billing">Billing &amp; Pricing</Link></div>
    <section className="admin-panel"><div className="admin-section-heading"><h2>All Companies</h2><span>{companies.length} total</span></div>
      {companies.length === 0 ? <p className="muted">No Companies are registered.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Company</th><th>Edition</th><th>Status</th><th>Trial end</th><th>Created</th><th>Users</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{companies.map(company => <tr key={company.id}><td><strong>{company.name}</strong></td><td>{company.productEdition}</td><td><span className={`admin-status status-${company.subscriptionStatus.toLowerCase()}`}>{company.subscriptionStatus}</span></td><td>{date(company.trialEndsAt)}</td><td>{date(company.createdAt)}</td><td>{company._count.users}</td><td><Link className="admin-manage-action" href={`/admin/companies/${company.id}`}>Manage Company</Link></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
