import "../globals.css";
import { redirect } from "next/navigation";
import { requiresFirstUsePhoneVerification } from "@/lib/auth/first-use-phone-policy";
import "../functional-polish.css";
import { requireUser } from "@/lib/auth/authorization";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { SalesHandoffBanner } from "@/components/telecalling/sales-handoff-banner";
import { db } from "@/lib/db";
import { webWorkspaceContext } from "@/lib/auth/web-workspace";
import { salesHeaderCapabilities, salesHeaderPresentation } from "@/lib/auth/sales-header-policy";
import {isTelecaller} from "@/lib/telecalling/policy";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED === "true") {
    const phoneState = await db.user.findUnique({
      where: { id: user.id },
      select: { role: true, companyId: true, phone: true, phoneVerifiedAt: true },
    });
    if (phoneState && requiresFirstUsePhoneVerification(phoneState)) redirect("/verify-mobile");
  }
  const [company, workspace] = await Promise.all([
    user.companyId ? db.company.findUnique({ where: { id: user.companyId }, select: { name: true, productEdition: true, logoObjectKey: true, updatedAt: true, addressLine1: true, addressLine2: true, locality: true, city: true, state: true, postalCode: true, country: true } }) : null,
    webWorkspaceContext(user),
  ]);
  const presentation = salesHeaderPresentation(user.salesRole, user.managerType, user.designation);
  if (!company || !workspace?.canAccessSales || !presentation) return <>{children}</>;
  const notificationCount = await db.salesNotification.count({where:{companyId:user.companyId!,recipientUserId:user.id,readAt:null}});
  const navigation = salesHeaderCapabilities(user, company.productEdition);
  const companyAddress = company ? [company.addressLine1, company.addressLine2, company.locality, company.city, company.state, company.postalCode, company.country].filter(Boolean).join(", ") : "";
  return <><WorkspaceHeader name={user.name} {...navigation} role={presentation.kind} roleLabel={presentation.label} notificationCount={notificationCount} canSwitchWorkspace={workspace.canSwitchWorkspace} activeWorkspace={workspace.effectiveWorkspace ?? "SALES"} companyName={company?.name || "SalesPunch360"} companyAddress={companyAddress} hasCompanyLogo={Boolean(company?.logoObjectKey)} companyLogoVersion={company?.updatedAt.getTime()} />{!isTelecaller(user)&&workspace.effectiveWorkspace==="SALES"?<SalesHandoffBanner/>:null}{children}</>;
}