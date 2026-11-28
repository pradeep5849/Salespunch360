import { configuredCashfreeEnvironment } from "@/lib/billing/cashfree-config";
import Checkout from "../checkout/checkout-client";
export const dynamic = "force-dynamic";
export default function Page() { return configuredCashfreeEnvironment()==="sandbox" ? <Checkout environment="sandbox"/> : <main><h1>Update SalesPunch360</h1><p>This test-payment link cannot process live payments. Update the app and reopen billing.</p></main>; }
