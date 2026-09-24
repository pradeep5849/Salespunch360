"use server";
import { revalidatePath } from "next/cache";
import { createLead, createLeadFromVisit, editLead } from "@/lib/leads/service";
import { LeadError } from "@/lib/leads/policy";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { transitionLeadWithProjectForActor } from "@/lib/leads/transition-with-project";

export type LeadActionState = { error?: string; success?: string };

const fields = (f: FormData) => ({
  title: f.get("title"),
  customerId: f.get("customerId"),
  contactName: f.get("contactName"),
  phone: f.get("phone"),
  email: f.get("email"),
  companyName: f.get("companyName"),
  source: f.get("source") || "MANUAL",
  estimatedValue: f.get("estimatedValue"),
  currencyCode: f.get("currencyCode") || "INR",
  followUpAt: f.get("followUpAt"),
  notes: f.get("notes"),
  assignedUserId: f.get("assignedUserId"),
});

export async function saveLead(_: LeadActionState, f: FormData): Promise<LeadActionState> {
  try {
    if (f.get("visitId")) {
      const all = fields(f);
      const { source, customerId, ...safe } = all;
      void source;
      void customerId;
      await createLeadFromVisit({ ...safe, visitId: f.get("visitId") });
    } else if (f.get("leadId")) {
      await editLead({ ...fields(f), leadId: f.get("leadId"), version: f.get("version") } as never);
    } else {
      await createLead(fields(f) as never);
    }
    revalidatePath("/workspace/leads");
    return { success: "Lead saved." };
  } catch (error) {
    return {
      error: error instanceof LeadError && error.code === "ACTIVE_FOLLOW_UP"
        ? "Complete the active follow-up checkout before reassigning this lead."
        : "Unable to save the lead. Check its details and your access.",
    };
  }
}

export async function moveLead(_: LeadActionState, f: FormData): Promise<LeadActionState> {
  try {
    const user = await requirePermissionForMutation("SALES_LEADS");
    if (!user.companyId || !user.salesRole) return { error: "Unable to move this lead. Refresh and try again." };
    const leadId = String(f.get("leadId"));
    const actor = {
      id: user.id,
      companyId: user.companyId,
      salesRole: user.salesRole,
      managerType: user.managerType,
      branchAccessScope: user.branchAccessScope,
      branchIds: user.branchIds,
    };
    const result = await transitionLeadWithProjectForActor(actor, {
      leadId,
      version: f.get("version"),
      toStage: String(f.get("toStage")),
      lostReason: f.get("lostReason"),
    });
    revalidatePath("/workspace/leads");
    revalidatePath(`/workspace/leads/${leadId}`);
    revalidatePath("/workspace/account/projects");
    return {
      success: result.project
        ? `Lead won. Project ${result.project.projectNumber} created.`
        : "Pipeline updated.",
    };
  } catch {
    return { error: "Unable to move this lead. Refresh and try again." };
  }
}

export async function deleteLeadAction(f: FormData): Promise<void> {
  const { permanentlyDeleteLead } = await import("@/lib/leads/deletion");
  await permanentlyDeleteLead(String(f.get("leadId")));
  revalidatePath("/workspace/leads");
  revalidatePath("/workspace");
}
