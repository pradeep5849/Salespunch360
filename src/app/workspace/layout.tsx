import { requireUser } from "@/lib/auth/authorization";
import { ProfileMenu } from "@/components/workspace/profile-menu";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user=await requireUser();
  const role=user.role;
  return <>{children}{(role==="COMPANY_ADMIN"||role==="MANAGER"||role==="SALES")&&<div className="workspace-profile-global"><ProfileMenu name={user.name} role={role}/></div>}</>;
}
