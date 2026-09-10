"use server";
import {redirect} from "next/navigation";import {createCommercialDocument} from "@/lib/account/commercial";
export async function saveCommercialDocument(form:FormData){const row=await createCommercialDocument(JSON.parse(String(form.get("payload"))));redirect(`/workspace/account/transactions/${row.id}`)}
