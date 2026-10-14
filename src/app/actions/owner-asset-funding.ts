"use server";
import { revalidatePath } from "next/cache";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { accountAction } from "@/lib/account/action-feedback";
import {
  allocateOwnerAssetFundingForActor,
  cancelOwnerAssetFundingForActor,
  confirmAssetFundingForActor,
} from "@/lib/account/owner-asset-funding";
const refresh = () => {
  revalidatePath("/workspace/account/money", "layout");
  revalidatePath("/workspace/account/assets");
};
export async function saveAssetFundingAction(fd: FormData) {
  return accountAction(async () => {
    const actor = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
    if (!actor.companyId) throw new Error("NOT_AUTHORIZED");
    await allocateOwnerAssetFundingForActor(
      { ...actor, companyId: actor.companyId },
      {
        branchId: fd.get("branchId"),
        assetId: fd.get("assetId"),
        ownerFinancialAccountId: fd.get("ownerFinancialAccountId"),
        contributionTransactionId: fd.get("contributionTransactionId"),
        amount: fd.get("amount"),
        allocationDate: fd.get("allocationDate"),
        requestKey: fd.get("requestKey"),
        expectedPurchaseValue: fd.get("expectedPurchaseValue"),
        confirmCompanyRemainder: fd.get("confirmCompanyRemainder") === "on",
      },
    );
    refresh();
  }, "Asset funding recorded");
}
export async function saveAssetFundingConfirmationAction(fd: FormData) {
  return accountAction(async () => {
    const actor = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
    if (!actor.companyId) throw new Error("NOT_AUTHORIZED");
    await confirmAssetFundingForActor(
      { ...actor, companyId: actor.companyId },
      {
        assetId: fd.get("assetId"),
        branchId: fd.get("branchId"),
        expectedPurchaseValue: fd.get("expectedPurchaseValue"),
        confirmed: fd.get("confirmed") === "true",
        reason: fd.get("reason"),
        requestKey: fd.get("requestKey"),
      },
    );
    refresh();
  }, "Funding classification recorded");
}
export async function cancelAssetFundingAction(fd: FormData) {
  return accountAction(async () => {
    const actor = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
    if (!actor.companyId) throw new Error("NOT_AUTHORIZED");
    await cancelOwnerAssetFundingForActor(
      { ...actor, companyId: actor.companyId },
      {
        fundingId: fd.get("fundingId"),
        reason: fd.get("reason"),
        requestKey: fd.get("requestKey"),
        expectedPurchaseValue: fd.get("expectedPurchaseValue"),
        confirmCompanyRemainder: fd.get("confirmCompanyRemainder") === "on",
      },
    );
    refresh();
  }, "Funding allocation corrected");
}
