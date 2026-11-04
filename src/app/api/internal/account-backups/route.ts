import { authorizedJobRunner } from "@/lib/field-jobs/service";
import { generateScheduledAccountBackups } from "@/lib/account/backup-settings";
export async function POST(request: Request) {
  if (!authorizedJobRunner(request.headers.get("authorization")))
    return Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  return Response.json(await generateScheduledAccountBackups(), {
    headers: { "Cache-Control": "no-store" },
  });
}
