import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { operationalBranchContext, type OperationalActor } from "@/lib/branches/operational-scope";
import { ensureWonLeadProjectInTx } from "./won-project";
import { LeadError, transitionKind, visibilityWhere } from "./policy";
import { transitionLeadSchema } from "./validation";

export type LeadTransitionActor = OperationalActor & {
  salesRole: "PRIMARY_ADMIN" | "ADMIN" | "MANAGER" | "SALES";
  managerType?: "FIELD_MANAGER" | "MANAGER_ONLY" | null;
};

/**
 * Move a lead and, when it becomes Won, create the Account project in the
 * same database transaction. This keeps Web and Android consistent and
 * prevents a lead from being committed as Won while an entitled project
 * handover silently fails.
 */
export async function transitionLeadWithProjectForActor(actor: LeadTransitionActor, raw: unknown) {
  const input = transitionLeadSchema.parse(raw);
  const branches = await operationalBranchContext(actor);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "leads" WHERE "id"=${input.leadId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
    const old = await tx.lead.findFirst({
      where: {
        id: input.leadId,
        companyId: actor.companyId,
        branchId: branches.branchId,
        ...visibilityWhere(actor),
      },
    });
    if (!old) throw new LeadError("NOT_FOUND");
    if (old.version !== input.version) throw new LeadError("STALE");

    const kind = transitionKind(actor.salesRole, old.stage, input.toStage);
    const now = new Date();
    const terminal = input.toStage === "WON"
      ? { wonAt: now, lostAt: null, lostReason: null }
      : input.toStage === "LOST"
        ? { lostAt: now, wonAt: null, lostReason: input.lostReason! }
        : { wonAt: null, lostAt: null, lostReason: null };

    const changed = await tx.lead.updateMany({
      where: { id: input.leadId, companyId: actor.companyId, version: input.version, stage: old.stage },
      data: { stage: input.toStage, ...terminal, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new LeadError("STALE");

    await tx.leadActivity.create({
      data: {
        companyId: actor.companyId,
        leadId: input.leadId,
        actorUserId: actor.id,
        type: kind,
        fromStage: old.stage,
        toStage: input.toStage,
      },
    });

    const project = input.toStage === "WON"
      ? await ensureWonLeadProjectInTx(tx, { id: actor.id, companyId: actor.companyId }, input.leadId, now)
      : null;

    return { project };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
