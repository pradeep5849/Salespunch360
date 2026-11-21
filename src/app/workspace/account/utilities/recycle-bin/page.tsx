import Link from "next/link";
import { AccountCard, AccountEmptyState, AccountPageHeader } from "@/components/account/account-shell";
import { RecycleRestoreForm } from "@/components/account/recycle-restore-form";
import { requirePermission } from "@/lib/auth/authorization";
import { recycleListForCompany } from "@/lib/account/recycle-list";
import { formatIndiaDate } from "@/lib/account/presentation";
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  const actor = await requirePermission("ACCOUNT_SETTINGS");
  const result = await recycleListForCompany(actor.companyId!, await searchParams);
  const href = (page: number) => `?${new URLSearchParams({ page: String(page), q: result.q })}`;
  return <><AccountPageHeader title="Recycle Bin" subtitle="Scheduled cleanup removes unlinked records after seven days; linked history is retained."/>
    <form><label>Search archived name<input name="q" defaultValue={result.q} maxLength={160}/></label><button>Search</button></form>
    <AccountCard>{result.items.length ? <div className="account-list">{result.items.map(x => <div key={x.id}><span><strong>{x.displayName}</strong><small>{x.entityType} · archived {formatIndiaDate(x.archivedAt)} · {x.reason}{x.purgeBlockedReason ? ` · Retained: ${x.purgeBlockedReason.replaceAll("_", " ").toLowerCase()}` : ""}</small></span><RecycleRestoreForm id={x.id}/></div>)}</div> : <AccountEmptyState title="No archived records found" detail="Try another search or an earlier page."/>}</AccountCard>
    <nav aria-label="Recycle Bin pages">{result.page > 1 && <Link href={href(result.page - 1)}>Previous</Link>}<span> Page {result.page} </span>{result.hasMore && <Link href={href(result.page + 1)}>Next</Link>}</nav>
  </>;
}
