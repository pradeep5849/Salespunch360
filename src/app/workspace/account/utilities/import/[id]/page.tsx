import {
  AccountCard,
  AccountPageHeader,
} from "@/components/account/account-shell";
import { requirePermission } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import {
  executeAccountImport,
  assertImportPreviewScope,
  type ImportPreview,
} from "@/lib/account/imports";
import { revalidatePath } from "next/cache";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission("ACCOUNT_ACCOUNTS"),
    { id } = await params;
  const job = await db.accountImportJob.findFirst({
    where: { id, companyId: actor.companyId! },
  });
  if (!job) throw new Error("IMPORT_JOB_NOT_FOUND");
  const preview = job.metadata as unknown as ImportPreview & {
    result?: { created: number; updated: number; skipped: number };
  };
  assertImportPreviewScope(actor, preview);
  async function confirm() {
    "use server";
    await executeAccountImport(id);
    revalidatePath(`/workspace/account/utilities/import/${id}`);
  }
  return (
    <>
      <AccountPageHeader
        title={`${job.importType.replaceAll("_", " ")} preview`}
        subtitle={`${job.validCount} valid · ${job.invalidCount} errors · ${job.status}`}
      />
      <AccountCard>
        {preview.result && (
          <p role="status">
            Created {preview.result.created} · Updated {preview.result.updated}{" "}
            · Skipped {preview.result.skipped}
          </p>
        )}
        <div className="account-list">
          {preview.rows.map((row) => (
            <div key={row.rowNumber}>
              <section>
                <h2>
                  Row {row.rowNumber} · {row.action}
                </h2>
                <dl>
                  {Object.entries(row.values).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replaceAll("_", " ")}</dt>
                      <dd>{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
                {row.resolved.existingId && (
                  <p>Matched record: {row.resolved.existingId}</p>
                )}
                <p>
                  {[...row.errors, ...row.warnings].join(" · ") || "Validated"}
                </p>
              </section>
            </div>
          ))}
        </div>
        {job.invalidCount === 0 && job.status === "READY" && (
          <form action={confirm}>
            <p>
              Confirm these row values and actions before changing company
              records.
            </p>
            <button className="account-danger">Confirm & execute import</button>
          </form>
        )}
      </AccountCard>
    </>
  );
}
