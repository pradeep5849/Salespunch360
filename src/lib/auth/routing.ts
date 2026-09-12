import type { ProductEdition } from "@prisma/client";
import { resolveWorkspaceAccess, type WorkspacePrincipal } from "./workspace-policy";

export function authenticatedHome(user:Pick<WorkspacePrincipal,"role">&Partial<WorkspacePrincipal>, edition?:ProductEdition|null, preferred?:string|null){
 if(user.role==="SUPER_ADMIN")return "/admin";
 if (edition) {
  const workspace=resolveWorkspaceAccess(user as WorkspacePrincipal,edition,preferred).effectiveWorkspace;
  if(workspace==="SALES")return "/workspace";
  if(workspace==="ACCOUNT")return "/workspace/account";
  return "/sign-in";
 }
 // Compatibility for callers which have not loaded the authoritative Company yet.
 if(user.salesRole&&user.salesAccessActive)return "/workspace";
 if(user.accountRole&&user.accountAccessActive)return "/workspace/account";
 return "/sign-in";
}
