"use server";

import { redirect } from "next/navigation";
import { requireAccountWorkspaceForMutation, requireUserForMutation, AuthorizationError } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { resolveWorkspaceAccess, type WebWorkspace } from "@/lib/auth/workspace-policy";
import { rememberWebWorkspace } from "@/lib/auth/web-workspace";
import { rememberAccountBranchContext, resolveAccountBranchContext } from "@/lib/account/branch-context";

export async function switchWorkspace(formData: FormData) {
  const actor = await requireUserForMutation();
  const workspace = String(formData.get("workspace")) as WebWorkspace;
  if (workspace !== "SALES" && workspace !== "ACCOUNT") throw new AuthorizationError();
  if (!actor.companyId) throw new AuthorizationError();
  const company = await db.company.findUnique({ where: { id: actor.companyId }, select: { productEdition: true } });
  if (!company) throw new AuthorizationError();
  const access = resolveWorkspaceAccess(actor, company.productEdition);
  if (!access.canSwitchWorkspace || (workspace === "SALES" ? !access.canAccessSales : !access.canAccessAccount)) throw new AuthorizationError();
  await rememberWebWorkspace(workspace);
  redirect(workspace === "SALES" ? "/workspace" : "/workspace/account");
}

export async function selectAccountBranch(formData: FormData) {
  const actor = await requireAccountWorkspaceForMutation();
  const value = String(formData.get("context") ?? "");
  const requested = value === "all" ? { scope: "all" } : { branchId: value };
  await resolveAccountBranchContext(actor, requested);
  await rememberAccountBranchContext(value);
  redirect(value === "all" ? "/workspace/account/dashboard?scope=all" : `/workspace/account/dashboard?branchId=${encodeURIComponent(value)}`);
}
