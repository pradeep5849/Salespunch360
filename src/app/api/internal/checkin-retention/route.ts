import { authorizedJobRunner } from "@/lib/field-jobs/service";
import { cleanupExpiredCheckIns } from "@/lib/visits/retention";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorizedJobRunner(request.headers.get("authorization")))
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  try {
    const report = await cleanupExpiredCheckIns();
    return Response.json(report, { status: report.storage.failed ? 503 : 200, headers });
  } catch {
    return Response.json({ error: "CLEANUP_FAILED" }, { status: 503, headers });
  }
}
