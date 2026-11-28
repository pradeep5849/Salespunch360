import { cashfreeConfig } from "@/lib/billing/cashfree-config";
import Checkout from "./checkout-client";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default function Page() {
  try {
    return <Checkout environment={cashfreeConfig().environment} />;
  } catch {
    return (
      <main>
        <h1>Payment unavailable</h1>
        <p>Return to the app and try again later.</p>
      </main>
    );
  }
}
