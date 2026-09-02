import { requireUser } from "@/lib/auth/authorization";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { db } from "@/lib/db";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user=await requireUser();
  const role=user.role;
  if(role!=="COMPANY_ADMIN"&&role!=="MANAGER"&&role!=="SALES")return <>{children}</>;
  const company=user.companyId?await db.company.findUnique({where:{id:user.companyId},select:{name:true,logoObjectKey:true,updatedAt:true}}):null;
  return <><WorkspaceHeader name={user.name} role={role} companyName={company?.name||"SalesPunch360"} hasCompanyLogo={Boolean(company?.logoObjectKey)} companyLogoVersion={company?.updatedAt.getTime()}/>{children}</>;
}
