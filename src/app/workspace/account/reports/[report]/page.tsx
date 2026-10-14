import { reportExportQuery } from "@/lib/account/reports/queries";
import { reportCalendarDate, reportFinancialYearStart } from "@/lib/account/reports/dates";
import { ReportTable } from "@/components/account/report-table";
import { notFound } from "next/navigation";
import { AuthorizationError } from "@/lib/auth/authorization";
import {
  reportOptions,
  runFinancialReport,
} from "@/lib/account/reports/service";
const valid = new Set([
    "profit-loss",
    "balance-sheet",
    "trial-balance",
    "cash-flow",
    "general-ledger",
    "customer-ledger",
    "vendor-ledger",
    "receivable-aging",
    "payable-aging",
    "cash-bank",
    "owner-capital",
    "profit-withdrawal",
    "projects",
    "branches",
    "items",
    "invoices",
    "customers",
    "tax",
    "budget-vs-actual",
  ]),
  iso = (d: Date) => d.toISOString().slice(0, 10);
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { report } = await params;
  if (!valid.has(report)) notFound();
  const q = await searchParams,
    options = await reportOptions(),
    projectLifetime = report === "projects" || report === "budget-vs-actual",
    profitability = ["items", "invoices", "customers"].includes(report),
    to = q.to || q.asOf || reportCalendarDate(),
    from = q.from || iso(reportFinancialYearStart(new Date(to)));
  let data;
  try {
    data = await runFinancialReport(
      report,
      projectLifetime
        ? { scope:q.scope, branchId: q.branchId, projectId: q.projectId }
        : {
            scope:q.scope,
            from,
            to,
            asOf: q.asOf,
            branchId: q.branchId,
            projectId: q.projectId,
            customerId: q.customerId,
            vendorId: q.vendorId,
            productId: q.productId,
            ledgerId: q.ledgerId,
            ownerId: q.ownerId,
          },
    );
  } catch (e) {
    if (e instanceof AuthorizationError) throw e;
    data = {
      title: report.replaceAll("-", " "),
      columns: [],
      rows: [],
      note: e instanceof Error ? e.message : "Unable to load report",
    };
  }
  const query = reportExportQuery(q,from,to,projectLifetime);
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <h1>{data.title}</h1>
        <form method="get" className="stack">
          {q.scope === "all" ? <input type="hidden" name="scope" value="all" /> : null}
          {projectLifetime ? (
            <p>
              Project profitability and budget-versus-actual figures are
              lifetime-to-date. Date filters do not apply.
            </p>
          ) : (
            <>
              <label>
                From
                <input name="from" type="date" defaultValue={from} />
              </label>
              <label>
                To / As of
                <input name="to" type="date" defaultValue={to} />
              </label>
            </>
          )}
          <Select
            name="branchId"
            label="Branch"
            value={q.branchId}
            rows={options.branches}
          />
          <Select
            name="projectId"
            label="Project"
            value={q.projectId}
            rows={options.projects}
          />
          {!projectLifetime && (
            <>
              <Select
                name="customerId"
                label="Customer"
                value={q.customerId}
                rows={options.customers}
              />
              {!profitability && <Select
                name="vendorId"
                label="Vendor"
                value={q.vendorId}
                rows={options.vendors}
              />}
              <Select
                name="productId"
                label="Product"
                value={q.productId}
                rows={options.products}
              />
              {(report === "owner-capital" ||
                report === "profit-withdrawal") && (
                <Select
                  name="ownerId"
                  label="Owner / Partner"
                  value={q.ownerId}
                  rows={options.owners}
                />
              )}
              {!profitability && <Select
                name="ledgerId"
                label="Ledger"
                value={q.ledgerId}
                rows={options.ledgers}
              />}
            </>
          )}
          <button>Run report</button>
        </form>
        <div>
          <a href={`/api/account/reports/${report}/csv?${query}`}>CSV</a> ·{" "}
          <a href={`/api/account/reports/${report}/xlsx?${query}`}>Excel</a> ·{" "}
          <a href={`/api/account/reports/${report}/pdf?${query}`}>PDF</a>
        </div>
        {data.note && <p>{data.note}</p>}
        {data.columns.length > 0 && (
          <div
            className="report-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Report results"
          >
            <ReportTable data={data} />
          </div>
        )}
      </section>
    </div>
  );
}
function Select({
  name,
  label,
  value,
  rows,
}: {
  name: string;
  label: string;
  value?: string;
  rows: Array<{
    id: string;
    name: string;
    code?: string | null;
    projectNumber?: string;
  }>;
}) {
  return (
    <label>
      {label}
      <select name={name} aria-label={label} defaultValue={value ?? ""}>
        <option value="">All / select</option>
        {rows.map((x) => (
          <option key={x.id} value={x.id}>
            {x.projectNumber ?? x.code ?? ""} {x.name}
          </option>
        ))}
      </select>
    </label>
  );
}
