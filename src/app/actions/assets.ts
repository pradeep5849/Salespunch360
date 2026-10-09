"use server";
import { accountAction } from "@/lib/account/action-feedback";
import { assetFormInput } from "@/lib/account/asset-input";
import { revalidatePath } from "next/cache";
import {
  assignAsset,
  createAsset,
  returnAsset,
  setAssetStatus,
  updateAsset,
} from "@/lib/account/assets";
export async function createAssetAction(f: FormData) {
  return accountAction(async () => {
    const row = await createAsset(assetFormInput(f));
    revalidatePath("/workspace/account/assets");
    return f.get("saveMode") === "new"
      ? `/workspace/account/assets/new?saved=${row.id}`
      : `/workspace/account/assets/${row.id}`;
  });
}
export async function updateAssetAction(f: FormData) {
  return accountAction(async () => {
    const id = String(f.get("id"));
    await updateAsset(id, assetFormInput(f, true));
    revalidatePath(`/workspace/account/assets/${id}`);
    return `/workspace/account/assets/${id}`;
  });
}
export async function assignAssetAction(f: FormData) {
  return accountAction(async () => {
    const id = String(f.get("id"));
    await assignAsset(
      id,
      String(f.get("userId")),
      String(f.get("notes") || ""),
    );
    revalidatePath(`/workspace/account/assets/${id}`);
  }, "Asset assignment saved");
}
export async function returnAssetAction(f: FormData) {
  return accountAction(async () => {
    const id = String(f.get("id"));
    await returnAsset(id, String(f.get("notes") || ""));
    revalidatePath(`/workspace/account/assets/${id}`);
  }, "Asset returned");
}
export async function assetStatusAction(f: FormData) {
  return accountAction(async () => {
    const id = String(f.get("id"));
    await setAssetStatus(id, String(f.get("status")) as never);
    revalidatePath(`/workspace/account/assets/${id}`);
  }, "Asset status updated");
}
