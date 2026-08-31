import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { SignInForm } from "./sign-in-form";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getAuthenticatedUser()) redirect("/workspace");
  return (
    <main className="login-page">
      <section className="login-card">
        <BrandLogo />
        <h1>Welcome Back!</h1>
        <p>Sign in to continue to your workspace</p>
        <SignInForm />
        <p className="register-link">Don’t have an account? <Link href="/register">Register now</Link></p>
      </section>
      <p className="login-copyright">© 2026 SalesPunch360. All rights reserved.</p>
    </main>
  );
}
