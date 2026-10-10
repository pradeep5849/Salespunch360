"use server";
import { revalidatePath } from "next/cache";
import { accountAction } from "@/lib/account/action-feedback";
import {
  consumeProjectMaterial,
  issueInventoryToProject,
  returnProjectMaterial,
  reverseProjectMaterial,
  transferProjectMaterial,
} from "@/lib/account/project-material-service";
const optionalMaterialFields = new Set([
  "projectBudgetLineId",
  "batchId",
  "serialNumberId",
  "attachmentKey",
]);
const payload = (f: FormData) =>
  f.get("payload")
    ? JSON.parse(String(f.get("payload")))
    : Object.fromEntries(
        [...f.entries()].filter(
          ([key, value]) =>
            key !== "payload" &&
            !(optionalMaterialFields.has(key) && value === ""),
        ),
      );
export async function issueProjectMaterialAction(f: FormData) {
  return accountAction(async () => {
    await issueInventoryToProject(payload(f));
    revalidatePath("/workspace/account/projects/material");
  }, "Material movement saved");
}
export async function consumeProjectMaterialAction(f: FormData) {
  return accountAction(async () => {
    await consumeProjectMaterial(payload(f));
    revalidatePath("/workspace/account/projects/material");
  }, "Material movement saved");
}
export async function returnProjectMaterialAction(f: FormData) {
  return accountAction(async () => {
    await returnProjectMaterial(payload(f));
    revalidatePath("/workspace/account/projects/material");
  }, "Material movement saved");
}
export async function transferProjectMaterialAction(f: FormData) {
  return accountAction(async () => {
    await transferProjectMaterial(payload(f));
    revalidatePath("/workspace/account/projects/material");
  }, "Material movement saved");
}
export async function reverseProjectMaterialAction(f: FormData) {
  return accountAction(async () => {
    await reverseProjectMaterial(payload(f));
    revalidatePath("/workspace/account/projects/material");
  }, "Material movement saved");
}
