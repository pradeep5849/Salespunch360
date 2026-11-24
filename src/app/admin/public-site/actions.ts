"use server";
import { validatedGooglePlayUrl } from "@/lib/public-site/android-url";
import { redirect } from "next/navigation";
import { publicProfiles } from "@/lib/public-site/discovery";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireGlobalSuperAdmin } from "@/lib/auth/authorization";
const url = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
};
export async function updatePublicSiteSettingsAction(fd: FormData) {
  await requireGlobalSuperAdmin();
  const requestedPlay = String(fd.get("googlePlayUrl") ?? "").trim();
  if (requestedPlay && !validatedGooglePlayUrl(requestedPlay))
    redirect("/admin/public-site?status=invalid");
  const data = {
    facebookUrl: url(fd.get("facebookUrl")),
    instagramUrl: url(fd.get("instagramUrl")),
    linkedinUrl: url(fd.get("linkedinUrl")),
    youtubeUrl: url(fd.get("youtubeUrl")),
    googlePlayUrl: validatedGooglePlayUrl(requestedPlay) ?? null,
  };
  for (const key of ["facebookUrl", "instagramUrl", "linkedinUrl", "youtubeUrl"] as const) {
    if (String(fd.get(key) ?? "").trim() && !publicProfiles({ [key]: data[key] }).length) redirect("/admin/public-site?status=invalid");
  }
  try {
  await db.publicSiteSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  } catch {
    redirect("/admin/public-site?status=error");
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/public-site");
  redirect("/admin/public-site?status=saved");
}
