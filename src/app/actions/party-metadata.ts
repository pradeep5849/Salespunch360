"use server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/authorization";
import {
  editPartyMetadata,
  type PartyKind,
} from "@/lib/account/party-metadata";
export async function savePartyMetadata(kind: PartyKind, raw: unknown) {
  try {
    const saved = await editPartyMetadata(kind, raw);
    revalidatePath(`/workspace/account/${kind}`);
    revalidatePath("/workspace/account");
    return { ok: true as const, ...saved };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const code =
      error instanceof AuthorizationError
        ? "FORBIDDEN"
        : error instanceof z.ZodError
          ? "INVALID_INPUT"
          : error instanceof Error &&
              ["PARTY_STALE", "PARTY_NOT_FOUND", "INVALID_INPUT"].includes(
                error.message,
              )
            ? error.message
            : "SAVE_FAILED";
    return { ok: false as const, error: code };
  }
}
