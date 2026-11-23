import type { Metadata } from "next";
import { requireGlobalSuperAdmin } from "@/lib/auth/authorization";
import { MigrationConsole } from "./migration-console";

export const metadata: Metadata = { title: "Check-in photo migration" };

export default async function MigrationPage() {
  await requireGlobalSuperAdmin();
  return <main style={{ maxWidth: 850, margin: "2rem auto", padding: "1rem" }}>
    <h1>Check-in photo migration</h1>
    <p>Restricted to platform super administrators. Inventory first; copying is disabled unless separately enabled on the server. No source photos are deleted.</p>
    <MigrationConsole />
  </main>;
}
