"use server";
import {redirect} from "next/navigation";import {revalidatePath} from "next/cache";import {applyAdvance,createCommercialDocument,createSettlement,postCommercialDocument,schedulePaymentReminder,setPaymentReminderStatus} from "@/lib/account/commercial";
const payload=(form:FormData)=>JSON.parse(String(form.get("payload")));
export async function saveCommercialDocument(form:FormData){const row=await createCommercialDocument(payload(form));redirect(`/workspace/account/transactions/${row.id}`)}
export async function postCommercialAction(form:FormData){const id=String(form.get("id"));await postCommercialDocument({documentId:id});revalidatePath(`/workspace/account/transactions/${id}`)}
export async function saveSettlementAction(form:FormData){await createSettlement(payload(form));redirect("/workspace/account/transactions")}
export async function applyAdvanceAction(form:FormData){await applyAdvance(form.has("payload")?payload(form):Object.fromEntries(form));redirect(`/workspace/account/transactions/${JSON.parse(String(form.get("payload"))).documentId}`)}
export async function saveReminderAction(form:FormData){await schedulePaymentReminder(form.has("payload")?payload(form):Object.fromEntries(form));revalidatePath(`/workspace/account/transactions/${JSON.parse(String(form.get("payload"))).documentId}`)}
export async function reminderStatusAction(form:FormData){await setPaymentReminderStatus({id:String(form.get("id")),status:String(form.get("status"))});revalidatePath("/workspace/account/transactions")}
