import Link from "next/link";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Money } from "@/components/account/account-ui";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import { ownerCapitalSummaryForActor } from "@/lib/account/owner-capital-summary";
import type { ProjectActor } from "@/lib/account/projects";
export async function OwnerCapitalSummary({showLink=true}:{showLink?:boolean}={}) {
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
      <h3>Posted company assets</h3><p><Money value={summary.companyAssets}/></p>
      <p>Book value across accessible branches, shown separately from owner capital. Unposted asset records are excluded.</p>
      {showLink&&<Link href="/workspace/account/money/capital">
        View Capital &amp; Drawings
      </Link>}
    </aside>
  );
}
