"use server";
import { revalidatePath } from "next/cache";
import {
  createAndReceiveLoan,
  createCheque,
  createMoneyAccount,
  postLoanPayment,
  postOwnerTransaction,
  setupOwnerFinancialAccount,
  transitionCheque,
} from "@/lib/account/money";
const raw = (fd: FormData) => Object.fromEntries(fd.entries()),
  refresh = () => revalidatePath("/workspace/account/money", "layout");
export async function moneyAccountAction(fd: FormData) {
  await createMoneyAccount(raw(fd));
  refresh();
}
export async function transferAction(fd: FormData) {
  const {requirePermissionForMutation}=await import("@/lib/auth/authorization");
  const {createMoneyTransferForActor}=await import("@/lib/account/money");
  const {prepareTransferImage,addTransferImageForActor}=await import("@/lib/account/money-transfer-image");
  const actor=await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");if(!actor.companyId)throw new Error("NOT_AUTHORIZED");
  const file=fd.get("image"),image=file instanceof File&&file.size?await prepareTransferImage(file):null;
  const scoped={...actor,companyId:actor.companyId},row=await createMoneyTransferForActor(scoped,raw(fd));
  if(image)try{await addTransferImageForActor(scoped,row.id,image);}catch{refresh();throw new Error("TRANSFER_POSTED_IMAGE_UPLOAD_FAILED");}
  refresh();
}
export async function chequeAction(fd: FormData) {
  if (fd.get("id"))
    await transitionCheque(
      String(fd.get("id")),
      String(fd.get("status")) as never,
      fd.get("clearedDate")
        ? new Date(String(fd.get("clearedDate")))
        : undefined,
    );
  else await createCheque(raw(fd));
  refresh();
}
export async function setupOwnerAction(fd: FormData) {
  await setupOwnerFinancialAccount(
    String(fd.get("userId")),
    String(fd.get("branchId")),
  );
  refresh();
}
export async function ownerTransactionAction(fd: FormData) {
  await postOwnerTransaction(raw(fd));
  refresh();
}
export async function loanAction(fd: FormData) {
  await createAndReceiveLoan(raw(fd));
  refresh();
}
export async function loanPaymentAction(fd: FormData) {
  await postLoanPayment(raw(fd));
  refresh();
}

export async function saveChequeAction(fd: FormData) {
  const { accountAction } = await import("@/lib/account/action-feedback");
  return accountAction(
    async () => {
      await chequeAction(fd);
    },
    fd.get("id") ? "Cheque status updated" : "Cheque recorded",
  );
}

export async function saveChequeFinancialAction(fd: FormData) {
  const { accountAction } = await import("@/lib/account/action-feedback");
  const { requirePermissionForMutation } =
    await import("@/lib/auth/authorization");
  const { chequeFinancialActionForActor } =
    await import("@/lib/account/cheque-finance");
  return accountAction(async () => {
    const actor = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
    const input = Object.fromEntries(fd.entries());
    delete input.id;
    if (!actor.companyId) throw new Error("NOT_AUTHORIZED");
    await chequeFinancialActionForActor(
      { ...actor, companyId: actor.companyId },
      String(fd.get("id")),
      {
        ...input,
        expectedVersion: Number(fd.get("expectedVersion")),
      },
    );
    refresh();
  }, "Cheque updated");
}

export async function searchChequeParties(rawInput: unknown) {
  const { requirePermissionForMutation, AuthorizationError } =
    await import("@/lib/auth/authorization");
  const { searchChequePartiesForActor } =
    await import("@/lib/account/cheque-parties");
  const actor = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
  if (!actor.companyId) throw new AuthorizationError();
  return searchChequePartiesForActor(
    { ...actor, companyId: actor.companyId },
    rawInput,
  );
}

export async function saveLegacyChequeSourceAction(fd: FormData) {
  const { accountAction } = await import("@/lib/account/action-feedback");
  const { requirePermissionForMutation, AuthorizationError } =
    await import("@/lib/auth/authorization");
  const { completeLegacyChequeSourceForActor } =
    await import("@/lib/account/cheque-finance");
  return accountAction(async () => {
    const actor = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
    if (!actor.companyId) throw new AuthorizationError();
    await completeLegacyChequeSourceForActor(
      { ...actor, companyId: actor.companyId },
      String(fd.get("id")),
      {
        partyId: String(fd.get("partyId")),
        amount: String(fd.get("amount")),
        requestKey: String(fd.get("requestKey")),
        expectedVersion: Number(fd.get("expectedVersion")),
      },
    );
    refresh();
  }, "Cheque source details saved; payment remains pending closure");
}

export async function saveMoneyAccountAction(fd: FormData) {
  const { accountAction } = await import("@/lib/account/action-feedback");
  return accountAction(async () => {
    await moneyAccountAction(fd);
  }, "Money account created");
}

export async function saveMoneyTransferAction(fd: FormData) {
  const { accountAction } = await import("@/lib/account/action-feedback");
  return accountAction(async () => {
    await transferAction(fd);
  }, "Transfer posted");
}

export async function saveMoneyAdjustmentAction(fd: FormData) {
  const { accountAction } = await import("@/lib/account/action-feedback");
  return accountAction(async () => {
    const { requirePermissionForMutation } =
      await import("@/lib/auth/authorization");
    const { postMoneyAdjustmentForActor } =
      await import("@/lib/account/money-adjustment");
    const a = await requirePermissionForMutation("ACCOUNT_MONEY_ENTRY");
    if (!a.companyId) throw new Error("NOT_AUTHORIZED");
    await postMoneyAdjustmentForActor(
      { ...a, companyId: a.companyId },
      raw(fd),
    );
    refresh();
  }, "Account adjustment posted");
}

export async function saveLoanAction(fd:FormData) {const {accountAction}=await import("@/lib/account/action-feedback");return accountAction(()=>loanAction(fd),"Loan received");}
export async function saveLoanPaymentAction(fd:FormData) {const {accountAction}=await import("@/lib/account/action-feedback");return accountAction(()=>loanPaymentAction(fd),"Loan payment posted");}

export async function saveMoneyAccountMetadataAction(fd:FormData){const {accountAction}=await import("@/lib/account/action-feedback");return accountAction(async()=>{const {updateMoneyAccount}=await import("@/lib/account/money");const data=raw(fd);delete data.id;await updateMoneyAccount(String(fd.get("id")),data);refresh();},"Account details saved");}

export async function saveLoanMetadataAction(fd:FormData){const {accountAction}=await import("@/lib/account/action-feedback");return accountAction(async()=>{const {requirePermissionForMutation}=await import("@/lib/auth/authorization");const {editLoanMetadataForActor}=await import("@/lib/account/loan-operations");const actor=await requirePermissionForMutation("ACCOUNT_LOAN_ADMIN");if(!actor.companyId)throw new Error("NOT_AUTHORIZED");const data=raw(fd);delete data.id;await editLoanMetadataForActor({...actor,companyId:actor.companyId},String(fd.get("id")),data);refresh();},"Loan details saved");}

export async function saveLoanTopUpAction(fd:FormData){const {accountAction}=await import("@/lib/account/action-feedback");return accountAction(async()=>{const {requirePermissionForMutation}=await import("@/lib/auth/authorization");const {topUpLoanForActor}=await import("@/lib/account/loan-operations");const actor=await requirePermissionForMutation("ACCOUNT_LOAN_ADMIN");if(!actor.companyId)throw new Error("NOT_AUTHORIZED");const data=raw(fd);delete data.id;await topUpLoanForActor({...actor,companyId:actor.companyId},String(fd.get("id")),data);refresh();},"Loan top-up received");}
export async function saveLoanLifecycleAction(fd:FormData){const {accountAction}=await import("@/lib/account/action-feedback");return accountAction(async()=>{const {requirePermissionForMutation}=await import("@/lib/auth/authorization");const {changeLoanLifecycleForActor}=await import("@/lib/account/loan-operations");const actor=await requirePermissionForMutation("ACCOUNT_LOAN_ADMIN");if(!actor.companyId)throw new Error("NOT_AUTHORIZED");const data=raw(fd);delete data.id;await changeLoanLifecycleForActor({...actor,companyId:actor.companyId},String(fd.get("id")),data);refresh();},"Loan updated");}
