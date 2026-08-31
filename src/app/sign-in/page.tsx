import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getAuthenticatedUser()) redirect("/workspace");
  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <a className="logo" href="https://www.salespunch360.com" aria-label="SalesPunch360 home">
          <span>SP</span> SalesPunch360
        </a>
        <div>
          <p className="eyebrow">Secure sales operations</p>
          <h1>Your team.<br />One clear view.</h1>
          <p className="brand-copy">A focused workspace built to help sales teams move with confidence.</p>
        </div>
        <p className="brand-foot">Tenant-isolated by design</p>
      </section>
      <section className="form-panel">
        <div className="form-card">
          <p className="mobile-logo"><span>SP</span> SalesPunch360</p>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your workspace</h2>
          <p className="muted">Use your company account to continue.</p>
          <SignInForm />
          <p className="register-link">New to SalesPunch360? <Link href="/register">Start your free trial</Link></p>
          <p className="support">Need access? Contact your company administrator.</p>
        </div>
      </section>
    </main>
  );
}
