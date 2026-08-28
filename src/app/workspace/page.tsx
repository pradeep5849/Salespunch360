import type { Metadata } from "next";
import { signOut } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage() {
  const user = await requireUser();
  return (
    <main className="workspace-shell">
      <nav><div className="logo"><span>SP</span> SalesPunch360</div><form action={signOut}><button className="ghost-button">Sign out</button></form></nav>
      <section className="workspace-content">
        <p className="eyebrow">Stage 1 workspace</p>
        <h1>Welcome, {user.name}</h1>
        <p className="muted">Your secure SalesPunch360 foundation is ready.</p>
        <div className="placeholder-card">
          <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div><strong>{user.email}</strong><p>{user.role.replaceAll("_", " ")}</p></div>
          <span className="status">Authenticated</span>
        </div>
      </section>
    </main>
  );
}
