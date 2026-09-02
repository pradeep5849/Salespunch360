import { requireUser } from "@/lib/auth/authorization";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { db } from "@/lib/db";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user=await requireUser();
  const role=user.role;
  if(role!=="COMPANY_ADMIN"&&role!=="MANAGER"&&role!=="SALES")return <>{children}</>;
  const company=user.companyId?await db.company.findUnique({where:{id:user.companyId},select:{name:true,logoObjectKey:true,updatedAt:true,addressLine1:true,addressLine2:true,locality:true,city:true,state:true,postalCode:true,country:true}}):null;
  const companyAddress=company?[company.addressLine1,company.addressLine2,company.locality,company.city,company.state,company.postalCode,company.country].filter(Boolean).join(", "):"";
  return <><WorkspaceHeader name={user.name} role={role} companyName={company?.name||"SalesPunch360"} companyAddress={companyAddress} hasCompanyLogo={Boolean(company?.logoObjectKey)} companyLogoVersion={company?.updatedAt.getTime()}/>{children}</>;
}
