import {
  cashfreeConfig,
  type CashfreeEnvironment,
} from "@/lib/billing/cashfree-config";
import Checkout from "./checkout-client";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function Page() {
  let environment: CashfreeEnvironment | null = null;
  try {
    environment = cashfreeConfig().environment;
  } catch {
    /* Fail closed without leaking configuration. */
  }
  if (!environment)
    return (
      <main>
        <h1>Payment unavailable</h1>
        <p>Return to the app and try again later.</p>
      </main>
    );
  return <Checkout environment={environment} />;
}
