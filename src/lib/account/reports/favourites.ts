import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { z } from "zod";
import { enabledModulesForCompany } from "../modules";
import { reportCatalogueWithFilters, reportsForRole } from "./catalogue";
type Actor = { id: string; companyId: string | null };
async function principal(actor: Actor) {
  if (!actor.companyId) throw new AuthorizationError();
  const user = await db.user.findFirst({
    where: { id: actor.id, companyId: actor.companyId },
    include: { company: { select: { productEdition: true } } },
  });
  if (
    !user?.company ||
    !canUsePermission(user, user.company.productEdition, "ACCOUNT_REPORTS")
  )
    throw new AuthorizationError();
  return user;
}
export async function availableReportCatalogueForActor(actor: Actor) {
  const user = await principal(actor),
    modules = await enabledModulesForCompany(actor.companyId!);
  const stockSettings=modules.includes("INVENTORY")&&canUsePermission(user,user.company!.productEdition,"ACCOUNT_STOCK")
    ?await db.accountSettings.findUnique({where:{companyId:actor.companyId!},select:{itemSettings:true}}):null;
  const canStock=modules.includes("INVENTORY")&&canUsePermission(user,user.company!.productEdition,"ACCOUNT_STOCK")
    &&(stockSettings?.itemSettings as {enabled?:boolean}|null)?.enabled!==false;
  return reportCatalogueWithFilters(reportsForRole(user.accountRole)).filter(
    (x) =>
      (!["order-transactions","order-items"].includes(x.key)||((modules.includes("SALES")&&modules.includes("SALES_ORDER"))||(modules.includes("PURCHASES")&&modules.includes("PURCHASE_ORDER"))))&&
      (!["sale-purchase-party","discount-party"].includes(x.key)||(modules.includes("SALES")&&modules.includes("PURCHASES")))&&
      (!["hsn-sales","sac-sales","gst-party","gst-rate","tds-receivable","tds-payable","tcs-receivable","tcs-collected"].includes(x.key)||modules.includes("GST_ADVANCED"))&&
      (!["hsn-sales","item-discount"].includes(x.key)||modules.includes("SALES"))&&
      (!["bank-statement","loan-statement"].includes(x.key)||canUsePermission(user,user.company!.productEdition,"ACCOUNT_MONEY_VIEW"))&&
      (!["stock-category","stock-detail","stock-summary","low-stock-summary","item-serial"].includes(x.key)||canStock)&&
      (!["purchase-register","purchase-report"].includes(x.key)||modules.includes("PURCHASES")) &&
      (!["projects", "budget-vs-actual", "material-consumption", "project-transfer"].includes(x.key) ||
      (modules.includes("PROJECTS") &&
        (x.key === "projects" || modules.includes("PROJECT_COSTING")))),
  );
}
export async function reportFavouritesForActor(actor: Actor) {
  const allowed = new Set(
    (await availableReportCatalogueForActor(actor)).map((x) => x.key),
  );
  return (
    await db.accountReportFavourite.findMany({
      where: { companyId: actor.companyId!, userId: actor.id },
      orderBy: { reportKey: "asc" },
      select: { reportKey: true },
    })
  )
    .map((x) => x.reportKey)
    .filter((x) => allowed.has(x));
}
export async function setReportFavouriteForActor(actor: Actor, raw: unknown) {
  const input = z
      .object({ reportKey: z.string().max(60), favourite: z.boolean() })
      .strict()
      .parse(raw),
    catalogue = await availableReportCatalogueForActor(actor);
  if (!catalogue.some((x) => x.key === input.reportKey))
    throw new AuthorizationError();
  const key = {
    companyId: actor.companyId!,
    userId: actor.id,
    reportKey: input.reportKey,
  };
  if (input.favourite)
    await db.accountReportFavourite.createMany({
      data: [key],
      skipDuplicates: true,
    });
  else await db.accountReportFavourite.deleteMany({ where: key });
  return reportFavouritesForActor(actor);
}
