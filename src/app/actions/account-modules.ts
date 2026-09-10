"use server";
import {revalidatePath} from "next/cache";import {updateModuleSettings} from "@/lib/account/modules";
export async function saveAccountModules(form:FormData){await updateModuleSettings({businessType:String(form.get("businessType")),enabledModules:form.getAll("enabledModules").map(String)});revalidatePath("/workspace/account");revalidatePath("/workspace/account/settings/modules")}
