import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/auth";
import { requireGlobalSuperAdmin } from "@/lib/auth/authorization";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireGlobalSuperAdmin();
  return <div className="admin-shell"><header className="admin-header">
    <Link href="/admin" className="admin-brand"><span>SP</span>SalesPunch360 <small>Super Admin</small></Link>
    <nav aria-label="Super Admin navigation"><Link href="/admin">Dashboard</Link><Link href="/admin/companies">Companies</Link><Link href="/admin/pricing">Pricing</Link><Link href="/admin/testimonials">Testimonials</Link><Link href="/admin/blog">Blog</Link><Link href="/admin/video-tutorials">Videos</Link><Link href="/admin/public-site">Website</Link><Link href="/admin/billing/orders">Billing</Link><form action={signOut}><button type="submit">Sign out</button></form></nav>
  </header>{children}</div>;
}
