import { PrismaClient } from "@prisma/client";
import { afterAll, expect, it } from "vitest";
import { reportCalendarDate, reportPeriodBounds } from "./dates";
import { reportExportQuery } from "./queries";

const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (url && (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) || !new URL(url).pathname.endsWith("_ci"))) {
  throw new Error("Isolated *_ci database required");
}
const client = new PrismaClient({ datasources: { db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" } } });
afterAll(() => client.$disconnect());

it.skipIf(!url)("A084-F13 commercial and journal report columns retain native date storage", async () => {
  const columns = await client.$queryRaw<{ table_name: string; column_name: string; data_type: string }[]>`
    SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND
      ((table_name = 'commercial_documents' AND column_name = 'issueDate') OR
       (table_name = 'journal_entries' AND column_name = 'entryDate'))
    ORDER BY table_name`;
  expect(columns).toEqual([
    { table_name: "commercial_documents", column_name: "issueDate", data_type: "date" },
    { table_name: "journal_entries", column_name: "entryDate", data_type: "date" },
  ]);
});

it.skipIf(!url)("A084-F13 final-day start noon and end are included while the next day is excluded", async () => {
  const bounds = reportPeriodBounds("TODAY", "2026-10-21");
  const from = new Date(`${bounds.from}T00:00:00.000Z`), to = new Date(`${bounds.to}T00:00:00.000Z`);
  // Read-only values use the same native date type as the two persisted report columns.
  const rows = await client.$queryRaw<{ label: string; in_period: boolean; as_of: boolean }[]>`
    WITH samples(label, instant) AS (VALUES
      ('previous', '2026-10-20T18:29:59.999Z'::timestamptz),
      ('start', '2026-10-20T18:30:00Z'::timestamptz),
      ('noon', '2026-10-21T06:30:00Z'::timestamptz),
      ('end', '2026-10-21T18:29:59.999Z'::timestamptz),
      ('next', '2026-10-21T18:30:00Z'::timestamptz))
    SELECT label,
      (instant AT TIME ZONE 'Asia/Kolkata')::date BETWEEN ${from}::date AND ${to}::date AS in_period,
      (instant AT TIME ZONE 'Asia/Kolkata')::date <= ${to}::date AS as_of
    FROM samples`;
  expect(rows).toEqual([
    { label: "previous", in_period: false, as_of: true },
    { label: "start", in_period: true, as_of: true },
    { label: "noon", in_period: true, as_of: true },
    { label: "end", in_period: true, as_of: true },
    { label: "next", in_period: false, as_of: false },
  ]);
  const query = new URLSearchParams(reportExportQuery({ from: "stale", to: "stale", asOf: bounds.to }, bounds.from, bounds.to));
  expect(query.get("from")).toBe(bounds.from);
  expect(query.get("to")).toBe(bounds.to);
  expect(query.get("asOf")).toBe(bounds.to);
  expect(reportCalendarDate(new Date("2026-10-21T18:29:59.999Z"))).toBe(bounds.to);
});
