import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { AuthenticatedUser } from "./session";
import { resolveWorkspaceAccess, type WebWorkspace } from "./workspace-policy";

const COOKIE = "sp360_web_workspace";

export async function webWorkspaceContext(actor: AuthenticatedUser) {
  const company = actor.companyId
    ? await db.company.findUnique({ where: { id: actor.companyId }, select: { productEdition: true } })
    : null;
  const preferred = (await cookies()).get(COOKIE)?.value;
  return company ? resolveWorkspaceAccess(actor, company.productEdition, preferred) : null;
}

export async function rememberWebWorkspace(workspace: WebWorkspace) {
  (await cookies()).set(COOKIE, workspace, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
