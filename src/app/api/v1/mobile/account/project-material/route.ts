import { z } from "zod";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileAuthorizationFailure,
  mobileJson,
  mobileUnauthorized,
  mobileUnexpected,
} from "@/lib/mobile/http";
import { permit } from "@/lib/mobile/account-transactions";
import {
  consumeProjectMaterialForActor,
  issueInventoryToProjectForActor,
  projectMaterialContextForActor,
  returnProjectMaterialForActor,
  reverseProjectMaterialForActor,
  transferProjectMaterialForActor,
} from "@/lib/account/project-material-service";
export async function GET(r: Request) {
  try {
    return mobileJson(
      await projectMaterialContextForActor(
        permit(
          await authenticateMobileToken(r.headers.get("authorization")),
          "ACCOUNT_PROJECT_MATERIAL_VIEW",
        ),
        {
          projectId: new URL(r.url).searchParams.get("projectId") ?? undefined,
          sourcePage: Number(
            new URL(r.url).searchParams.get("sourcePage") ?? 1,
          ),
          historyPage: Number(
            new URL(r.url).searchParams.get("historyPage") ?? 1,
          ),
        },
      ),
    );
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("PROJECT_MATERIAL_CONTEXT", e)
    );
  }
}
export async function POST(r: Request) {
  try {
    const user = await authenticateMobileToken(r.headers.get("authorization")),
      body = await r.json(),
      action = z
        .enum(["ISSUE", "CONSUME", "RETURN", "TRANSFER", "REVERSE"])
        .parse(body.action),
      raw = body.payload;
    const map = {
      ISSUE: ["ACCOUNT_PROJECT_COST_EDIT", issueInventoryToProjectForActor],
      CONSUME: [
        "ACCOUNT_PROJECT_MATERIAL_CONSUME",
        consumeProjectMaterialForActor,
      ],
      RETURN: [
        "ACCOUNT_PROJECT_MATERIAL_RETURN",
        returnProjectMaterialForActor,
      ],
      TRANSFER: [
        "ACCOUNT_PROJECT_MATERIAL_TRANSFER",
        transferProjectMaterialForActor,
      ],
      REVERSE: [
        "ACCOUNT_PROJECT_MATERIAL_TRANSFER",
        reverseProjectMaterialForActor,
      ],
    } as const;
    const [permission, fn] = map[action];
    return mobileJson(await fn(permit(user, permission), raw), 201);
  } catch (e) {
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      (e instanceof z.ZodError
        ? mobileJson({ error: "INVALID_INPUT" }, 400)
        : null) ??
      mobileUnexpected("PROJECT_MATERIAL_MUTATION", e)
    );
  }
}
