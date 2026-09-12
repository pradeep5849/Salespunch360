import {authenticatedHome} from "@/lib/auth/routing";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { RegistrationForm } from "./registration-form";
import { BrandLogo } from "@/components/brand-logo";
import { PUBLIC_PRODUCT_EDITIONS } from "@/lib/product/entitlements";
import { TRIAL_DURATION_DAYS } from "@/lib/trial/config";

export const metadata: Metadata = { title: "Start free trial" };

export default async function RegisterPage({searchParams}:{searchParams:Promise<{product?:string}>}) {
  const authenticated=await getAuthenticatedUser();if(authenticated) redirect(authenticatedHome(authenticated));
  const requested=(await searchParams).product;
  const initialProduct=PUBLIC_PRODUCT_EDITIONS.find(product=>product===requested);
  return (
    <main className="register-shell">
      <header className="register-header">
        <BrandLogo />
        <p>Already have an account? <Link href="/sign-in">Sign in</Link></p>
      </header>
      <section className="register-intro">
        <p className="eyebrow">{TRIAL_DURATION_DAYS}-day free trial</p>
        <h1>Create your company workspace</h1>
        <p className="muted">Choose Sales, Accounts, or both in one Company. No card required.</p>
      </section>
      <RegistrationForm initialProduct={initialProduct} />
    </main>
  );
}
