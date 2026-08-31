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
        <p className="login-tagline">Field force management, simplified</p>
        <h1>Welcome Back!</h1>
        <p className="login-subtitle">Sign in to continue</p>
        <SignInForm />
        <p className="register-link">Don&apos;t have an account? <Link href="/register">Register Now</Link></p>
      </section>
      <p className="login-copyright">© 2026 SalesPunch360. All rights reserved.</p>
    </main>
  );
}
