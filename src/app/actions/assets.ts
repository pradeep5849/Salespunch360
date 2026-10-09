"use server";
import { assetFormInput } from "@/lib/account/asset-input";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  assignAsset,
  createAsset,
  returnAsset,
  setAssetStatus,
  updateAsset,
} from "@/lib/account/assets";
export async function createAssetAction(f: FormData) {
  const row = await createAsset(assetFormInput(f));
  redirect(`/workspace/account/assets/${row.id}`);
}
export async function updateAssetAction(f: FormData) {
  const id = String(f.get("id"));
  await updateAsset(id, assetFormInput(f, true));
  redirect(`/workspace/account/assets/${id}`);
}
export async function assignAssetAction(f: FormData) {
  const id = String(f.get("id"));
  await assignAsset(id, String(f.get("userId")), String(f.get("notes") || ""));
  revalidatePath(`/workspace/account/assets/${id}`);
}
export async function returnAssetAction(f: FormData) {
  const id = String(f.get("id"));
  await returnAsset(id, String(f.get("notes") || ""));
  revalidatePath(`/workspace/account/assets/${id}`);
}
export async function assetStatusAction(f: FormData) {
  const id = String(f.get("id"));
  await setAssetStatus(id, String(f.get("status")) as never);
  revalidatePath(`/workspace/account/assets/${id}`);
}
