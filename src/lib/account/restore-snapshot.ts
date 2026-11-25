import { redactAuditMetadata } from "./audit-redaction";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
/** Identity, authentication, subscriptions and delivery/recovery records are never rolled back. */
const excluded = new Set([
  "User",
  "PushDevice",
  "WebPushDevice", // Session-bound credentials must never be restored from business backups.
  "CompanySubscription",
  "BillingOrder",
  "PaymentTransaction",
  "BillingAuditEvent",
  "PendingStorageDeletion",
  "AccountBackupRecord",
  "QuotationShare",
]);
const reviewedTables = new Set([
  "project_material_movements",
  "branches",
  "attendances",
  "customers",
  "customer_visits",
  "leads",
  "follow_up_tasks",
  "visit_photos",
  "lead_deletion_audits",
  "lead_activities",
  "location_points",
  "sales_notifications",
  "geofence_events",
  "sales_targets",
  "daily_travel_approvals",
  "employee_compensation_profiles",
  "employee_advances",
  "employee_reimbursements",
  "salary_history_links",
  "account_settings",
  "authorized_signature_versions",
  "financial_years",
  "numbering_series",
  "vendors",
  "account_units",
  "account_categories",
  "account_products",
  "account_services",
  "work_categories",
  "work_packages",
  "custom_field_definitions",
  "custom_field_values",
  "account_import_jobs",
  "account_recycle_records",
  "print_templates",
  "account_terms_templates",
  "ledger_accounts",
  "cost_centres",
  "journal_entries",
  "journal_lines",
  "accounting_period_locks",
  "accounting_audit_events",
  "quotation_documents",
  "quotation_revisions",
  "quotation_lines",
  "quotation_adjustments",
  "quotation_payment_schedules",
  "quotation_shares",
  "quotation_audit_events",
  "commercial_documents",
  "commercial_attachments",
  "payment_attachments",
  "service_reminder_completions",
  "commercial_document_lines",
  "purchase_line_allocations",
  "account_settlements",
  "settlement_allocations",
  "party_opening_balances",
  "opening_balance_allocations",
  "advance_applications",
  "payment_reminders",
  "commercial_audit_events",
  "projects",
  "project_members",
  "project_budget_lines",
  "project_milestones",
  "project_tasks",
  "project_documents",
  "project_audit_events",
  "project_change_orders",
  "expense_categories",
  "expense_transactions",
  "recurring_expense_templates",
  "expense_attachments",
  "money_accounts",
  "money_transfers",
  "money_transfer_images",
  "cheques",
  "owner_financial_accounts",
  "loans",
  "loan_operations",
  "loan_payments",
  "account_operational_audits",
  "asset_funding_confirmations",
  "asset_owner_fundings",
  "asset_owner_funding_cancellations",
  "owner_asset_funding_returns",
  "owner_transactions",
  "warehouses",
  "inventory_batches",
  "inventory_serial_numbers",
  "stock_movements",
  "product_prices",
  "assets",
  "asset_assignment_history",
  "field_jobs",
  "expense_items",
  "account_report_favourites",
  "quotation_attachments",
  "sale_return_revisions",
  "sale_revision_credits",
  "sale_revision_credit_lines",
  "sale_lifecycle_snapshots",
]);
const businessModels = Prisma.dmmf.datamodel.models.filter(
  (model) =>
    model.fields.some((field) => field.name === "companyId") &&
    !excluded.has(model.name),
);
export const RESTORE_MODELS = businessModels.filter((model) =>
  reviewedTables.has(model.dbName ?? model.name),
);
export const RESTORE_SCHEMA_HASH = createHash("sha256")
  .update(
    JSON.stringify({
      enums: Prisma.dmmf.datamodel.enums,
      models: RESTORE_MODELS.map((model) => ({
        name: model.name,
        primaryKey: model.primaryKey,
        fields: model.fields
          .filter((field) => field.kind !== "object")
          .map((field) => ({
            name: field.name,
            type: field.type,
            required: field.isRequired,
            list: field.isList,
          })),
      })),
    }),
  )
  .digest("hex");
export type RestoreSnapshot = {
  schemaHash: string;
  company: Record<string, unknown>;
  models: Record<string, Record<string, unknown>[]>;
};
type Delegate = {
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
  deleteMany: (args: unknown) => Promise<unknown>;
  createMany: (args: unknown) => Promise<unknown>;
};
export function restoreDelegate(tx: Prisma.TransactionClient, name: string) {
  const key = name[0].toLowerCase() + name.slice(1);
  return (tx as unknown as Record<string, Delegate>)[key];
}
export async function readRestoreSnapshot(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<RestoreSnapshot> {
  if (businessModels.length !== RESTORE_MODELS.length)
    throw new Error("RESTORE_SCHEMA_REVIEW_REQUIRED");
  const models: RestoreSnapshot["models"] = {};
  for (const model of RESTORE_MODELS)
    models[model.name] = await restoreDelegate(tx, model.name).findMany({
      where: { companyId },
      orderBy: (
        model.primaryKey?.fields ??
        model.fields.filter((field) => field.isId).map((field) => field.name)
      ).map((key) => ({ [key]: "asc" })),
    });
  const company = await tx.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      primaryPhone: true,
      contactEmail: true,
      gstin: true,
      addressLine1: true,
      addressLine2: true,
      locality: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      logoObjectKey: true,
    },
  });
  return { schemaHash: RESTORE_SCHEMA_HASH, company, models };
}
export function assertRestoreSnapshot(
  snapshot: RestoreSnapshot,
  companyId: string,
) {
  if (snapshot?.company?.id !== companyId)
    throw new Error("RESTORE_SCOPE_INVALID");
  if (
    !snapshot ||
    snapshot.schemaHash !== RESTORE_SCHEMA_HASH ||
    !snapshot.models ||
    Object.keys(snapshot.models).length !== RESTORE_MODELS.length
  )
    throw new Error("RESTORE_SCHEMA_UNSUPPORTED");
  for (const model of RESTORE_MODELS) {
    const rows = snapshot.models[model.name];
    if (!Array.isArray(rows)) throw new Error("RESTORE_INCOMPLETE_BACKUP");
    const keys = new Set(
        model.fields
          .filter((field) => field.kind !== "object")
          .map((field) => field.name),
      ),
      ids = new Set<string>();
    for (const row of rows) {
      const identity = JSON.stringify(
        (
          model.primaryKey?.fields ??
          model.fields.filter((field) => field.isId).map((field) => field.name)
        ).map((key) => row?.[key]),
      );
      if (
        !row ||
        typeof row !== "object" ||
        row.companyId !== companyId ||
        ids.has(identity) ||
        Object.keys(row).some((key) => !keys.has(key))
      )
        throw new Error("RESTORE_SCOPE_INVALID");
      ids.add(identity);
    }
  }
}
export function restoreRows(
  modelName: string,
  rows: Record<string, unknown>[],
) {
  const model = RESTORE_MODELS.find((model) => model.name === modelName)!;
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        const field = model.fields.find((field) => field.name === key)!;
        if (field.type === "DateTime" && typeof value === "string") {
          const date = new Date(value);
          if (!Number.isFinite(date.valueOf()))
            throw new Error("RESTORE_INVALID_DATE");
          return [key, date];
        }
        if (field.type === "Json" && value === null)
          return [key, Prisma.DbNull];
        return [key, value];
      }),
    ),
  );
}
export function snapshotDigest(snapshot: RestoreSnapshot) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        redactAuditMetadata({
          ...snapshot,
          models: {
            ...snapshot.models,
            AccountingAuditEvent: (
              snapshot.models.AccountingAuditEvent ?? []
            ).filter((row) => row.eventType !== "BACKUP_GENERATED"),
          },
        }),
      ),
    )
    .digest("hex");
}
