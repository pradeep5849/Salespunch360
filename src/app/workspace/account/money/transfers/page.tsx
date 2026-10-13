import {
  isMoneyReadScopeError,
  MoneyReadUnavailable,
} from "@/components/account/money-read-unavailable";
import { randomUUID } from "node:crypto";
import { MoneyTransferForm } from "@/components/account/money-transfer-form";
import { listMoneyData } from "@/lib/account/money";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
const businessToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; scope?: string }>;
}) {
  const query = await searchParams;
  let d: Awaited<ReturnType<typeof listMoneyData>>;
  try {
    d = await listMoneyData(query);
  } catch (error) {
    if (isMoneyReadScopeError(error)) return <MoneyReadUnavailable />;
    throw error;
  }
  return (
    <main className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title="Transfers & Cash Deposits"
          backHref="/workspace/account/money"
        />
        <p>
          Scope:{" "}
          {d.branchContext.mode === "COMPANY"
            ? "All company branches"
            : d.branchContext.branchName}
        </p>
        {d.capabilities.postMoneyEntries ? (
          <MoneyTransferForm
            branches={d.branches}
            accounts={d.dashboard.accounts.map(
              ({ id, name, branchId, isActive }) => ({
                id,
                name,
                branchId,
                isActive,
              }),
            )}
            requestKey={randomUUID()}
            today={businessToday()}
          />
        ) : (
          <p>
            You can view money accounts. Posting transfers requires Money Entry
            permission.
          </p>
        )}
      </section>
    </main>
  );
}
