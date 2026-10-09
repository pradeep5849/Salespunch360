import Link from "next/link";
import { assetPageRead } from "./page-access";
import { listAssets } from "@/lib/account/assets";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; offset?: string }>;
}) {
  const params = await searchParams,
    q = (params.q ?? "").slice(0, 240),
    status = params.status ?? "",
    offset = Math.max(0, Number.parseInt(params.offset ?? "0", 10) || 0),
    result = await assetPageRead(() =>
      listAssets({
        q,
        ...(status ? { status } : {}),
        offset,
        limit: 50,
      }),
    );
  const href = (next: number) =>
    `/workspace/account/assets?${new URLSearchParams({ q, status, offset: String(next) })}`;
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <h1>Assets</h1>
        <Link href="/workspace/account/assets/new">New asset</Link>
        <form method="get" className="stack">
          <label>
            Search asset name or number
            <input name="q" defaultValue={q} maxLength={240} />
          </label>
          <label>
            Asset status
            <select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {[
                "ACTIVE",
                "ASSIGNED",
                "UNDER_MAINTENANCE",
                "RETIRED",
                "DISPOSED",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <button>Apply filters</button>
          <Link href="/workspace/account/assets">Clear filters</Link>
        </form>
        {!result.items.length && (
          <p>
            {q || status
              ? "No assets match these filters. Clear or change your filters."
              : "No assets yet. Add an asset to track its value, assignments, and history."}
          </p>
        )}
        {result.items.map((x) => (
          <article key={x.id} style={{ overflowWrap: "anywhere" }}>
            <Link href={`/workspace/account/assets/${x.id}`}>
              {x.assetNumber} · {x.name}
            </Link>
            <p>
              {x.assetType} · {x.status} · ₹{x.purchaseValue.toFixed(2)}
            </p>
          </article>
        ))}
        <nav aria-label="Asset pages">
          {offset > 0 && (
            <Link href={href(Math.max(0, offset - 50))}>Previous assets</Link>
          )}{" "}
          {result.hasMore && <Link href={href(offset + 50)}>Next assets</Link>}
        </nav>
      </section>
    </div>
  );
}
