import Link from "next/link";
import { z } from "zod";
import { saveChequeAction } from "@/app/actions/money";
import {
  chequePageForActor,
  chequeListQuerySchema,
} from "@/lib/account/cheque-list";
import { db } from "@/lib/db";
import {
  requirePermission,
  AuthorizationError,
} from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { resolveAccountBranchContext } from "@/lib/account/branch-context";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { AccountDate } from "@/components/account/display-preferences";
import { ActionFeedbackForm } from "@/components/account/action-feedback-form";
import { SaveSubmitButton } from "@/components/account/save-feedback";
import { ChequeRecordForm } from "@/components/account/cheque-record-form";
import type { ChequeStatus } from "@prisma/client";
const transitions: Record<ChequeStatus, ChequeStatus[]> = {
  ISSUED: ["CLEARED", "BOUNCED", "CANCELLED"],
  RECEIVED: ["DEPOSITED", "CANCELLED"],
  DEPOSITED: ["CLEARED", "BOUNCED"],
  CLEARED: ["BOUNCED"],
  BOUNCED: [],
  CANCELLED: [],
};
async function load(raw: Record<string, string | undefined>) {
  const authenticated = await requirePermission("ACCOUNT_MONEY_VIEW");
  const actor = { ...authenticated, companyId: authenticated.companyId! };
  const context = await resolveAccountBranchContext(
    { ...actor, companyId: actor.companyId! },
    { branchId: raw.branchId, scope: raw.scope },
  );
  const query = chequeListQuerySchema.parse({
    q: raw.q || undefined,
    tab: raw.tab || undefined,
    status: raw.status || undefined,
    order: raw.order || undefined,
    offset: raw.offset ?? 0,
    branchId:
      context.context.mode === "BRANCH" ? context.context.branchId : undefined,
  });
  const data = await chequePageForActor(actor, query);
  const canWrite = canUsePermission(
    actor,
    "SALESPUNCH360_ACCOUNT",
    "ACCOUNT_MONEY_ENTRY",
  );
  const canReverse = canUsePermission(
    actor,
    "SALESPUNCH360_ACCOUNT",
    "ACCOUNT_JOURNAL_REVERSE",
  );
  const branches =
    context.context.mode === "BRANCH"
      ? context.branches.filter((row) => row.id === context.context.branchId)
      : context.branches;
  const accounts = canWrite
    ? await db.moneyAccount.findMany({
        where: {
          companyId: actor.companyId!,
          type: "BANK",
          isActive: true,
          OR: [
            { branchId: null },
            { branchId: { in: branches.map((row) => row.id) } },
          ],
        },
        select: { id: true, name: true, branchId: true },
        orderBy: { name: "asc" },
      })
    : [];
  return { context, query, data, branches, accounts, canWrite, canReverse };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  let result: Awaited<ReturnType<typeof load>>;
  try {
    result = await load(raw);
  } catch (error) {
    if (
      !(error instanceof z.ZodError) &&
      !(error instanceof AuthorizationError)
    )
      throw error;
    return (
      <section className="account-card" role="status">
        <h1>Cheques unavailable</h1>
        <p>
          {error instanceof z.ZodError
            ? "Check the selected cheque filters and try again."
            : "Your permission or branch access does not allow this view."}
        </p>
        <Link href="/workspace/account/money">Back to Money</Link>
      </section>
    );
  }
  const { data, query, context, canWrite, canReverse } = result;
  const href = (changes: Record<string, string>) => {
    const params = new URLSearchParams();
    for (const key of ["q", "tab", "status", "order", "branchId", "scope"])
      if (raw[key]) params.set(key, raw[key]!);
    for (const [key, value] of Object.entries(changes)) params.set(key, value);
    return `/workspace/account/money/cheques?${params}`;
  };
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Cheques"
          backHref="/workspace/account/money"
        />
        <p>
          Scope:{" "}
          {context.context.mode === "COMPANY"
            ? "Company consolidated"
            : context.context.branchName}
        </p>
        <nav aria-label="Cheque status tabs">
          {(["OPEN", "CLOSED", "ALL"] as const).map((tab) => (
            <Link
              key={tab}
              href={href({ tab, offset: "0" })}
              aria-current={query.tab === tab ? "page" : undefined}
            >
              {tab[0] + tab.slice(1).toLowerCase()}{" "}
            </Link>
          ))}
        </nav>
        <form method="get" className="stack">
          {raw.branchId && (
            <input type="hidden" name="branchId" value={raw.branchId} />
          )}
          {raw.scope && <input type="hidden" name="scope" value={raw.scope} />}
          <input type="hidden" name="tab" value={query.tab} />
          <input type="hidden" name="order" value={query.order} />
          <label>
            Search cheques
            <input name="q" defaultValue={query.q ?? ""} maxLength={160} />
          </label>
          <button>Search</button>
        </form>
        <Link
          href={href({
            order: query.order === "desc" ? "asc" : "desc",
            offset: "0",
          })}
          aria-label={`Date order: ${query.order === "desc" ? "newest first" : "oldest first"}`}
        >
          Date {query.order === "desc" ? "↓" : "↑"}
        </Link>
        {canWrite && (
          <details suppressHydrationWarning>
            <summary>Record cheque</summary>
            <ChequeRecordForm
              branches={result.branches}
              accounts={result.accounts}
            />
          </details>
        )}
        {!data.rows.length && (
          <div role="status">
            <h2>
              No {query.tab === "ALL" ? "" : query.tab.toLowerCase() + " "}
              cheques{query.q ? " match this search" : ""}
            </h2>
            <p>
              {query.q
                ? "Try another cheque number, party or reference."
                : "Recorded cheques appear here in the selected branch scope."}
            </p>
          </div>
        )}
        {data.rows.map((row) => {
          const actions = transitions[row.status].filter(
            (status) =>
              (status !== "CLEARED" || Boolean(row.journalEntryId)) &&
              (status !== "BOUNCED" || !row.journalEntryId || canReverse),
          );
          return (
            <article
              key={row.id}
              className="account-card"
              aria-label={`Cheque ${row.chequeNumber}`}
            >
              <h2>{row.partyName}</h2>
              <p>
                Cheque {row.chequeNumber} · {row.status}
              </p>
              <p>
                Date: <AccountDate value={row.chequeDate.toISOString()} />
              </p>
              <p>Bank: {row.moneyAccount?.name ?? "Account unavailable"}</p>
              {row.reference && <p>Reference: {row.reference}</p>}
              {row.clearedDate && (
                <p>
                  Cleared: <AccountDate value={row.clearedDate.toISOString()} />
                </p>
              )}
              {canWrite && actions.length > 0 && (
                <ActionFeedbackForm action={saveChequeAction} className="stack">
                  <input type="hidden" name="id" value={row.id} />
                  <label>
                    Action for cheque {row.chequeNumber}
                    <select name="status">
                      {actions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Action date for cheque {row.chequeNumber}
                    <input name="clearedDate" type="date" />
                  </label>
                  <SaveSubmitButton>
                    Update cheque {row.chequeNumber}
                  </SaveSubmitButton>
                </ActionFeedbackForm>
              )}
            </article>
          );
        })}
        <nav aria-label="Cheque pagination">
          {data.total
            ? `${data.offset + 1}–${data.offset + data.rows.length}`
            : "0"}{" "}
          of {data.total} cheques
          {data.offset > 0 && (
            <>
              {" "}
              ·{" "}
              <Link
                href={href({
                  offset: String(Math.max(0, data.offset - data.limit)),
                })}
              >
                Previous page
              </Link>
            </>
          )}
          {data.nextOffset !== null && (
            <>
              {" "}
              ·{" "}
              <Link href={href({ offset: String(data.nextOffset) })}>
                Next page
              </Link>
            </>
          )}
        </nav>
      </section>
    </main>
  );
}
