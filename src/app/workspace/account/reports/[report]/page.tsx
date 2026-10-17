import tabsStyles from "./cash-bank-tabs.module.css";
import Link from "next/link";
import {TransactionReportView} from "@/components/account/transaction-report-view";
import {ReportSummary} from "@/components/account/report-summary";
import {accountErrorMessage,isAccountDomainError} from "@/lib/account/action-feedback";
import {ReportDateRange} from "@/components/account/report-date-range";
import {ACCOUNT_REPORT_KEYS,reportSpecificFilters} from "@/lib/account/reports/catalogue";
import { reportExportQuery } from "@/lib/account/reports/queries";
import { reportCalendarDate, reportFinancialYearStart } from "@/lib/account/reports/dates";
import { ReportTable } from "@/components/account/report-table";
import { notFound } from "next/navigation";
import { AuthorizationError } from "@/lib/auth/authorization";
import {
  reportOptions,
  runFinancialReport,
} from "@/lib/account/reports/service";
const valid = new Set(ACCOUNT_REPORT_KEYS),
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
    applicableFilters = reportSpecificFilters(report),
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
            accountType:q.accountType,
          },
    );
  } catch (e) {
    if (e instanceof AuthorizationError) throw e;
    data = {
      title: report.replaceAll("-", " "),
      columns: [],
      rows: [],
      note: isAccountDomainError(e)?accountErrorMessage((e as Error).message):e instanceof Error ? e.message : "Unable to load report",
    };
  }
  const query = reportExportQuery(q,from,to,projectLifetime);
  const hubQuery=new URLSearchParams([...new URLSearchParams(query)].filter(([key])=>["scope","from","to","asOf","branchId"].includes(key))).toString();
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <Link className={tabsStyles.back} href={`/workspace/account/reports?${hubQuery}`} aria-label="Back to reports">← Reports</Link>
        <h1>{data.title}</h1>
        <form method="get" className="stack">
          {q.scope === "all" ? <input type="hidden" name="scope" value="all" /> : null}
          {projectLifetime ? (
            <p>
              Project profitability and budget-versus-actual figures are
              lifetime-to-date. Date filters do not apply.
            </p>
          ) : (
            <ReportDateRange initialFrom={from} initialTo={to} today={reportCalendarDate()}/>

          )}
          <Select
            name="branchId"
            label="Branch"
            value={q.branchId}
            rows={options.branches}
          />
          {applicableFilters.includes("projectId")&&<Select
            name="projectId"
            label="Project"
            value={q.projectId}
            rows={options.projects}
          />}
          {!projectLifetime && (
            <>
              {applicableFilters.includes("customerId")&&<Select
                name="customerId"
                label="Customer"
                value={q.customerId}
                rows={options.customers}
              />}
              {applicableFilters.includes("vendorId") && <Select
                name="vendorId"
                label="Vendor"
                value={q.vendorId}
                rows={options.vendors}
              />}
              {applicableFilters.includes("productId")&&<Select
                name="productId"
                label="Product"
                value={q.productId}
                rows={options.products}
              />}
              {(report === "owner-capital" ||
                report === "profit-withdrawal") && (
                <Select
                  name="ownerId"
                  label="Owner / Partner"
                  value={q.ownerId}
                  rows={options.owners}
                />
              )}
              {applicableFilters.includes("ledgerId") && <Select
                name="ledgerId"
                label="Ledger"
                value={q.ledgerId}
                rows={options.ledgers}
              />}
            </>
          )}
          {report==="cash-bank"&&q.accountType&&<input type="hidden" name="accountType" value={q.accountType}/>}
          <button>Run report</button>
        </form>
        <div>
          <a href={`/api/account/reports/${report}/csv?${query}`}>CSV</a> ·{" "}
          <a href={`/api/account/reports/${report}/xlsx?${query}`}>Excel</a> ·{" "}
          <a href={`/api/account/reports/${report}/pdf?${query}`}>PDF</a>
        </div>
        {report==="cash-bank"&&<nav aria-label="Cash and bank account types" className={tabsStyles.tabs}>{[["","All accounts"],["CASH","Cash"],["BANK","Bank"],["PETTY_CASH","Petty cash"]].map(([value,label])=>{const tab=new URLSearchParams(query);if(value)tab.set("accountType",value);else tab.delete("accountType");return <Link key={value} href={`/workspace/account/reports/cash-bank?${tab.toString()}`} aria-current={(q.accountType??"")===value?"page":undefined}>{label}</Link>})}</nav>}
        {data.summary&&<ReportSummary items={data.summary}/>}
        {data.note && <p>{data.note}</p>}
        {data.columns.length > 0 && (
          <div
            className="report-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Report results"
          >
            {["sale-report","purchase-report","expense-transactions"].includes(report)?<TransactionReportView data={data}/>:<ReportTable data={data}/>}
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
