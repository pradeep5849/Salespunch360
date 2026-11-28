import { cashfreeConfig } from "./cashfree-config";
import { createCashfreeOrder, fetchCashfreeOrder, fetchCashfreePayments, verifyCashfreeWebhook } from "./cashfree-client";
function sandbox() { if (cashfreeConfig().environment !== "sandbox") throw new Error("CASHFREE_SANDBOX_UNAVAILABLE"); }
export async function createSandboxOrder(input: Parameters<typeof createCashfreeOrder>[0]) { sandbox(); return createCashfreeOrder(input); }
export function fetchSandboxOrder(id: string) { sandbox(); return fetchCashfreeOrder(id); }
export function fetchSandboxPayments(id: string) { sandbox(); return fetchCashfreePayments(id); }
export function verifySandboxWebhook(body: string, timestamp: string, signature: string) { sandbox(); return verifyCashfreeWebhook(body, timestamp, signature); }
