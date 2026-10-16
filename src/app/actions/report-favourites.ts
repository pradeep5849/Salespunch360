"use server";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { setReportFavouriteForActor } from "@/lib/account/reports/favourites";
export async function saveReportFavourite(
  reportKey: string,
  favourite: boolean,
) {
  return setReportFavouriteForActor(
    await requirePermissionForMutation("ACCOUNT_REPORTS"),
    { reportKey, favourite },
  );
}
