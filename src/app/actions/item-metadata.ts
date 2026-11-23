"use server";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/authorization";
import { editItemMetadata, type ItemKind } from "@/lib/account/item-metadata";
export async function saveItemMetadata(kind: ItemKind, raw: unknown) {
  try {
    const saved = await editItemMetadata(kind, raw);
    revalidatePath(`/workspace/account/${kind}`);
    revalidatePath("/workspace/account/inventory", "layout");
    return { ok: true as const, ...saved };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return {
      ok: false as const,
      error:
        error instanceof AuthorizationError
          ? "FORBIDDEN"
          : error instanceof z.ZodError
            ? "INVALID_INPUT"
            : error instanceof Error &&
                ["ITEM_STALE", "ITEMS_DISABLED", "INVALID_INPUT"].includes(
                  error.message,
                )
              ? error.message
              : "SAVE_FAILED",
    };
  }
}
