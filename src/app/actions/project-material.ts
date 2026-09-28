"use server";
import { redirect } from "next/navigation";
import {
  consumeProjectMaterial,
  issueInventoryToProject,
  returnProjectMaterial,
  reverseProjectMaterial,
  transferProjectMaterial,
} from "@/lib/account/project-material-service";
const payload = (f: FormData) =>
  f.get("payload")
    ? JSON.parse(String(f.get("payload")))
    : Object.fromEntries([...f.entries()].filter(([key]) => key !== "payload"));
export async function issueProjectMaterialAction(f: FormData) {
  await issueInventoryToProject(payload(f));
  redirect("/workspace/account/projects/material");
}
export async function consumeProjectMaterialAction(f: FormData) {
  await consumeProjectMaterial(payload(f));
  redirect("/workspace/account/projects/material");
}
export async function returnProjectMaterialAction(f: FormData) {
  await returnProjectMaterial(payload(f));
  redirect("/workspace/account/projects/material");
}
export async function transferProjectMaterialAction(f: FormData) {
  await transferProjectMaterial(payload(f));
  redirect("/workspace/account/projects/material");
}
export async function reverseProjectMaterialAction(f: FormData) {
  await reverseProjectMaterial(payload(f));
  redirect("/workspace/account/projects/material");
}
