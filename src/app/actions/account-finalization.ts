"use server";
import {requirePermission} from "@/lib/auth/authorization";
import {previewFinancialYearCloseForActor} from "@/lib/account/utilities";
export async function previewCloseYearAction(id:string){
  const actor=await requirePermission("ACCOUNT_PERIOD_LOCK");
  return previewFinancialYearCloseForActor({...actor,companyId:actor.companyId!},id);
}
import { redirect } from "next/navigation"; import { revalidatePath } from "next/cache"; import { archiveProject, closeFinancialYear, restoreMaster } from "@/lib/account/utilities"; import { previewAccountImport, saveImportPreview } from "@/lib/account/imports"; import { setPeriodLock } from "@/lib/accounting/service";
export async function uploadAccountImport(fd: FormData) { const file = fd.get("file"); if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error("INVALID_IMPORT_FILE"); const preview = await previewAccountImport({ type: String(fd.get("type")) as never, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()), updateExisting: fd.get("updateExisting") === "on" }); const job = await saveImportPreview(preview); redirect(`/workspace/account/utilities/import/${job.id}`); }
export async function closeYearAction(fd: FormData) { if(fd.get("confirmed")!=="on")throw new Error("CLOSE_CONFIRMATION_REQUIRED"); await closeFinancialYear({ financialYearId: String(fd.get("financialYearId")), earlyCloseReason: String(fd.get("reason") ?? "") }); revalidatePath("/workspace/account/utilities/financial-year"); }
export async function advancePeriodLockAction(fd: FormData) { await setPeriodLock({ financialYearId: String(fd.get("financialYearId")), lockedThrough: String(fd.get("lockedThrough")), reason: String(fd.get("reason")) }); revalidatePath("/workspace/account/utilities/period-locks"); }
export async function restoreMasterAction(fd: FormData) { await restoreMaster(String(fd.get("recycleId"))); revalidatePath("/workspace/account/utilities/recycle-bin"); }

export async function archiveProjectAction(fd: FormData) {
  const id = String(fd.get("projectId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("INVALID_PROJECT_ID");
  await archiveProject(id, "Archived by account administrator");
  revalidatePath("/workspace/account/projects");
  revalidatePath("/workspace/account/utilities/recycle-bin");
  redirect("/workspace/account/projects");
}
