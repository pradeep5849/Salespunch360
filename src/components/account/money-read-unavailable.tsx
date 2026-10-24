import Link from "next/link";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/authorization";
export const isMoneyReadScopeError = (error: unknown) =>
  error instanceof AuthorizationError || error instanceof z.ZodError;
export function MoneyReadUnavailable() {
  return (
    <section className="employees-content">
      <p role="alert">
        Money accounts are unavailable for the requested branch or scope.
      </p>
      <Link href="/workspace/account">Return to Account</Link>
    </section>
  );
}
