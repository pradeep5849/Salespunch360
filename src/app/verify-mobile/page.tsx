import Link from "next/link";
import { VerifyMobileForm } from "./verify-mobile-form";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { requiresFirstUsePhoneVerification } from "@/lib/auth/first-use-phone-policy";
import { signOut } from "@/app/actions/auth";
import { db } from "@/lib/db";

export default async function VerifyMobilePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/sign-in");
  const state = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true, companyId: true, phone: true, phoneVerifiedAt: true },
  });
  if (!state || !requiresFirstUsePhoneVerification(state)) redirect("/workspace");
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem", background: "rgba(15, 23, 42, 0.08)" }}>
      <section role="dialog" aria-modal="true" aria-labelledby="first-use-phone-title" style={{ width: "100%", maxWidth: 480, padding: "2rem", borderRadius: 16, background: "white", boxShadow: "0 18px 55px rgba(15,23,42,.18)" }}>
      <h1 id="first-use-phone-title">Verify your mobile number</h1>
      <p>Before entering your workspace for the first time, verify your mobile number with the SMS code.</p>
      <VerifyMobileForm initialPhone={state.phone ?? ""} />
      <form action={signOut}><button type="submit">Sign out</button></form>
      <p><Link href="/privacy">Privacy Policy</Link></p>
      </section>
    </main>
  );
}
