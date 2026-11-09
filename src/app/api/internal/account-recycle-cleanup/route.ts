import { authorizedJobRunner } from "@/lib/field-jobs/service";
import { purgeExpiredRecycleRecords } from "@/lib/account/recycle-retention";
export async function POST(request: Request) {
  if (!authorizedJobRunner(request.headers.get("authorization")))
    return Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const report = await purgeExpiredRecycleRecords();
  return Response.json(report, {
    status: report.failed > 0 ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
