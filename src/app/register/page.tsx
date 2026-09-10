import {authenticatedHome} from "@/lib/auth/routing";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { RegistrationForm } from "./registration-form";
import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = { title: "Start free trial" };

export default async function RegisterPage() {
  const authenticated=await getAuthenticatedUser();if(authenticated) redirect(authenticatedHome(authenticated));
  return (
    <main className="register-shell">
      <header className="register-header">
        <BrandLogo />
        <p>Already have an account? <Link href="/sign-in">Sign in</Link></p>
      </header>
      <section className="register-intro">
        <p className="eyebrow">15-day free trial</p>
        <h1>Create your company workspace</h1>
        <p className="muted">Choose Sales, Accounts, or both in one Company. No card required.</p>
      </section>
      <RegistrationForm />
    </main>
  );
}
