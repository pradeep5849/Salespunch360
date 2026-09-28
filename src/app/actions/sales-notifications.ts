"use server";
import {revalidatePath} from "next/cache";
import {markAllSalesNotificationsRead,markSalesNotificationRead} from "@/lib/sales-notifications/service";
export async function markSalesNotificationReadAction(form:FormData){await markSalesNotificationRead(String(form.get("id")??""));revalidatePath("/workspace/notifications");}
export async function markAllSalesNotificationsReadAction(){await markAllSalesNotificationsRead();revalidatePath("/workspace/notifications");}
