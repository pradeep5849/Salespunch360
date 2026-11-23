import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { requiresFirstUsePhoneVerification } from "@/lib/auth/first-use-phone-policy";
import { signOut } from "@/app/actions/auth";
import { db } from "@/lib/db";

/**
 * Safe holding screen until Firebase Web SMS client is installed and validated.
 * Do not turn on FIRST_USE_PHONE_VERIFICATION_ENABLED until the SMS UI works.
 */
export default async function VerifyMobilePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/sign-in");
  const state = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true, companyId: true, phone: true, phoneVerifiedAt: true },
  });
  if (!state || !requiresFirstUsePhoneVerification(state)) redirect("/workspace");
  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "1.5rem" }}>
      <h1>Verify your mobile number</h1>
      <p>Mobile verification is required before accessing your workspace.</p>
      <p>SMS verification is not available yet. Please contact your company administrator or try again later.</p>
      <form action={signOut}><button type="submit">Sign out</button></form>
      <p><Link href="/privacy">Privacy Policy</Link></p>
    </main>
  );
}
