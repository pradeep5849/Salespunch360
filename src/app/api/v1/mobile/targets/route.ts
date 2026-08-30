import { authenticateMobileToken } from "@/lib/mobile/auth";
import { createTarget, editTarget, listTargets } from "@/lib/targets/service";
import { mobileJson } from "@/lib/mobile/http";

const actor = async (request: Request) => {
  const p = await authenticateMobileToken(request.headers.get("authorization"));
  return { id: p.id, name: p.name, role: p.role, companyId: p.companyId };
};
function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "INVALID_INPUT";
  if (code === "MOBILE_UNAUTHORIZED") return mobileJson({ error: "UNAUTHORIZED" }, 401);
  if (code === "NOT_AUTHORIZED" || code === "Not authorized") return mobileJson({ error: "FORBIDDEN" }, 403);
  if (["STALE", "SUBSCRIPTION_REQUIRED"].includes(code)) return mobileJson({ error: code }, 409);
  return mobileJson({ error: code || "INVALID_INPUT" }, 400);
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return mobileJson(await listTargets(Object.fromEntries(url.searchParams), await actor(request)));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try { const a = await actor(request); await createTarget(await request.json(), a); return mobileJson(await listTargets({}, a), 201); } catch (error) { return failure(error); }
}
export async function PATCH(request: Request) {
  try { const a = await actor(request); await editTarget(await request.json(), a); return mobileJson(await listTargets({}, a)); } catch (error) { return failure(error); }
}
