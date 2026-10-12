import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Money } from "@/components/account/account-ui";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import { ownerCapitalSummaryForActor } from "@/lib/account/owner-capital-summary";
import type { ProjectActor } from "@/lib/account/projects";
export async function OwnerCapitalSummary() {
  let summary: Awaited<ReturnType<typeof ownerCapitalSummaryForActor>> | null =
    null;
  let unavailable = false;
  try {
    const actor = (await requirePermission(
      "ACCOUNT_MONEY_VIEW",
    )) as ProjectActor;
    summary = await ownerCapitalSummaryForActor(actor);
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthorizationError) return null;
    unavailable = true;
  }
  if (unavailable || !summary)
    return (
      <aside aria-label="Owner capital">
        <p>Owner capital could not be loaded. Refresh to retry.</p>
      </aside>
    );
  return (
    <aside aria-label="Owner capital">
      <h2>Owner capital</h2>
      <p>
        <Money value={summary.capital} /> · {summary.ownerCount} owners /
        partners
      </p>
      <p>Shown separately from asset values.</p>
      <Link href="/workspace/account/money/capital">
        View Capital &amp; Drawings
      </Link>
    </aside>
  );
}
