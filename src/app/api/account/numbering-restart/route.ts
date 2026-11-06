import { requirePermissionForMutation } from "@/lib/auth/authorization";
import {
  numberingRestartOptions,
  numberingRestartFailure,
} from "@/lib/account/numbering-restart";
import { numberingRestartRequest } from "@/lib/account/numbering-restart-request";
export async function GET() {
  try {
    const actor = await requirePermissionForMutation("ACCOUNT_SETTINGS");
    return Response.json(
      await numberingRestartOptions({ ...actor, companyId: actor.companyId! }),
    );
  } catch (error) {
    return numberingRestartFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await requirePermissionForMutation("ACCOUNT_SETTINGS");
    return Response.json(
      await numberingRestartRequest(
        { ...actor, companyId: actor.companyId! },
        await request.json(),
      ),
    );
  } catch (error) {
    return numberingRestartFailure(error);
  }
}
