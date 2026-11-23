import {OpeningPartyFields} from "@/components/account/opening-party-fields";
import {AccountDate} from "@/components/account/display-preferences";
import { ManualJournalForm } from "@/components/account/manual-journal-form";
import { ActionFeedbackForm } from "@/components/account/action-feedback-form";
import { SaveSubmitButton } from "@/components/account/save-feedback";
import Link from "next/link";
import { journalHistory } from "@/lib/accounting/service";
import { openingRegistrationOptions } from "@/lib/account/opening-balances";
import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { accountingOverview } from "@/lib/accounting/service";
import { accountingAction } from "@/app/actions/accounting";
const titles: Record<string, string> = {
  accounts: "Chart of Accounts",
  journals: "Journal Entries",
  new: "New Manual Journal",
  "cost-centres": "Cost Centres",
  opening: "Opening Balances",
  periods: "Period Lock Settings",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { section } = await params;
  if (!titles[section]) notFound();
  const d = await accountingOverview(),
    opening =
      section === "opening" && d.capabilities.canPostOpening
        ? await openingRegistrationOptions()
        : null;
  const query = await searchParams,
    history =
      section === "journals"
        ? await journalHistory(
            Object.fromEntries(Object.entries(query).filter(([, v]) => v)),
          )
        : null;
  const historyHref = (page: number) =>
    `?${new URLSearchParams({ ...(Object.fromEntries(Object.entries(query).filter(([, v]) => v)) as Record<string, string>), page: String(page) })}`;
  const mayPost =
    section === "opening"
      ? d.capabilities.canPostOpening
      : d.capabilities.canPost;
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={titles[section]}
          backHref="/workspace/account"
        />
        {opening && (
          <ActionFeedbackForm
            action={accountingAction}
            className="account-master-form"
          >
            <input
              type="hidden"
              name="operation"
              value="register-party-opening"
            />
            <h2>Register a party opening balance</h2>
            <p>
              Connect an existing posted opening journal to a customer
              receivable or vendor payable. No second journal is posted.
            </p>
            <OpeningPartyFields options={{...opening,journals:opening.journals.map(row=>({...row,entryDate:row.entryDate.toISOString().slice(0,10)}))}}/>
            <SaveSubmitButton>Register party opening</SaveSubmitButton>
          </ActionFeedbackForm>
        )}
        {section === "accounts" && (
          <>
            {d.capabilities.canManageChart && (
              <ActionFeedbackForm
                action={accountingAction}
                className="account-master-form"
              >
                <input type="hidden" name="operation" value="account" />
                <label>
                  Code
                  <input name="code" required maxLength={30} />
                </label>
                <label>
                  Name
                  <input name="name" required maxLength={120} />
                </label>
                <label>
                  Account class
                  <select name="accountClass">
                    {["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map(
                      (x) => (
                        <option key={x}>{x}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Normal balance
                  <select name="normalBalance">
                    <option>DEBIT</option>
                    <option>CREDIT</option>
                  </select>
                </label>
                <SaveSubmitButton>Add account</SaveSubmitButton>
              </ActionFeedbackForm>
            )}
            {d.ledgerAccounts.map((x) => (
              <p key={x.id}>
                {x.code} · {x.name} · {x.accountClass}
                {x.isSystem ? " · System" : ""}
              </p>
            ))}
          </>
        )}
        {section === "cost-centres" && (
          <>
            {d.capabilities.canManageChart && (
              <ActionFeedbackForm
                action={accountingAction}
                className="account-master-form"
              >
                <input type="hidden" name="operation" value="cost-centre" />
                <label>
                  Code
                  <input name="code" required maxLength={30} />
                </label>
                <label>
                  Name
                  <input name="name" required maxLength={120} />
                </label>
                <SaveSubmitButton>Add cost centre</SaveSubmitButton>
              </ActionFeedbackForm>
            )}
            {d.costCentres.map((x) => (
              <article key={x.id}>
                <p>{x.code} · {x.name}</p><p>{x.description||"No description"}</p>
                {d.capabilities.canManageChart&&<details><summary>Edit cost centre</summary>
                  <ActionFeedbackForm action={accountingAction} className="account-master-form">
                    <input type="hidden" name="operation" value="edit-cost-centre"/><input type="hidden" name="id" value={x.id}/><input type="hidden" name="updatedAt" value={x.updatedAt.toISOString()}/>
                    <label>Code<input name="code" required maxLength={30} defaultValue={x.code}/></label>
                    <label>Name<input name="name" required maxLength={120} defaultValue={x.name}/></label>
                    <label>Description<textarea name="description" maxLength={2000} defaultValue={x.description??""}/></label>
                    <SaveSubmitButton>Save cost centre</SaveSubmitButton>
                  </ActionFeedbackForm>
                </details>}
              </article>
            ))}
          </>
        )}
        {(section === "new" || section === "opening") && mayPost && (
          <ManualJournalForm
            opening={section === "opening"}
            years={d.financialYears.filter(year=>year.status==="OPEN"&&year.isActive)}
            branches={d.branches}
            accounts={d.ledgerAccounts.filter(
              (x) => x.allowPosting && x.isActive,
            )}
            costCentres={d.costCentres.filter((x) => x.isActive)}
          />
        )}
        {section === "journals" && (
          <form method="get">
            <label>
              Search journals
              <input name="q" defaultValue={query.q} maxLength={160} />
            </label>
            <label data-branch-ui>
              Branch
              <select name="branchId" defaultValue={query.branchId ?? ""}>
                <option value="">All accessible branches</option>
                {d.branches.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              From
              <input type="date" name="from" defaultValue={query.from} />
            </label>
            <label>
              To
              <input type="date" name="to" defaultValue={query.to} />
            </label>
            <button>Apply filters</button>
          </form>
        )}
        {section === "journals" &&
          history?.items.map((x) => (
            <article key={x.id}>
              <strong>
                <Link href={`/workspace/account/accounting/journals/${x.id}`}>{x.journalNumber}</Link> · {x.status}
              </strong>
              <p>
                {<AccountDate value={x.entryDate.toISOString()}/>} · {x.narration}
              </p>
            </article>
          ))}
        {history && (
          <nav aria-label="Journal pages">
            {history.page > 1 && (
              <Link href={historyHref(history.page - 1)}>Previous page</Link>
            )}
            <span>Page {history.page}</span>
            {history.hasMore && (
              <Link href={historyHref(history.page + 1)}>Next page</Link>
            )}
          </nav>
        )}
        {section === "periods" && <section aria-label="Current period locks"><h2>Current period locks</h2>
          {d.accountingPeriodLocks.length?d.accountingPeriodLocks.map(lock=><article key={lock.id}>
            <strong>{d.financialYears.find(year=>year.id===lock.financialYearId)?.name??"Financial year"}</strong>
            <p>Locked through: {lock.lockedThrough?<AccountDate value={lock.lockedThrough.toISOString().slice(0,10)}/>:"Not set"}</p>
            <p>Last updated: <AccountDate value={lock.updatedAt.toISOString()}/></p>
          </article>):<p>No period locks have been set.</p>}
          <h3>Recent lock history (latest 50 changes)</h3>
          {(d.accountingAuditEvents??[]).map(event=><p key={event.id}><AccountDate value={event.createdAt.toISOString()}/> · {event.reason||"No reason recorded"}</p>)}
          <Link href="/workspace/account/utilities/period-locks">Review year locks</Link>
        </section>}
        {section === "periods" && d.capabilities.canManagePeriods && (
          <ActionFeedbackForm
            action={accountingAction}
            className="account-master-form"
          >
            <input type="hidden" name="operation" value="period-lock" />
            <label>
              Financial year
              <select name="financialYearId">
                {d.financialYears.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lock through date
              <input name="lockedThrough" type="date" required />
            </label>
            <label>
              Reason
              <input name="reason" required minLength={3} maxLength={1000} />
            </label>
            <p>Locks can only move forward. Blank dates do not clear a lock.</p>
            <SaveSubmitButton>Save period lock</SaveSubmitButton>
          </ActionFeedbackForm>
        )}
      </section>
    </div>
  );
}
