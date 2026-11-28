export type CashfreeEnvironment = "sandbox" | "production";
export const CASHFREE_API_VERSION = "2023-08-01";
export function configuredCashfreeEnvironment(): CashfreeEnvironment | null {
  const value = process.env.CASHFREE_ENV;
  if (!value) return null;
  if (value !== "sandbox" && value !== "production")
    throw new Error("CASHFREE_CONFIGURATION_INVALID");
  return value;
}
export function cashfreeConfig() {
  const environment = configuredCashfreeEnvironment();
  const appId = process.env.CASHFREE_APP_ID?.trim();
  const secret = process.env.CASHFREE_SECRET_KEY?.trim();
  if (!environment || !appId || !secret)
    throw new Error("CASHFREE_UNAVAILABLE");
  return {
    environment,
    appId,
    secret,
    apiUrl:
      environment === "production"
        ? "https://api.cashfree.com/pg"
        : "https://sandbox.cashfree.com/pg",
    provider: environment === "production" ? "CASHFREE" : "CASHFREE_SANDBOX",
    paymentPrefix:
      environment === "production" ? "cashfree_live_" : "cashfree_sandbox_",
  };
}
export function cashfreeAvailable() {
  try {
    cashfreeConfig();
    return true;
  } catch {
    return false;
  }
}
export function assertCashfreeOrderEnvironment(
  order: { paymentEnvironment?: string | null },
  environment = cashfreeConfig().environment,
) {
  // All records predating the production migration were sandbox-only. Never reinterpret them as live.
  if ((order.paymentEnvironment ?? "sandbox") !== environment)
    throw new Error("PAYMENT_ENVIRONMENT_MISMATCH");
}
export function isCashfreeProvider(provider: string) {
  return provider === "CASHFREE" || provider === "CASHFREE_SANDBOX";
}
