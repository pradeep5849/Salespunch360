import { notFound } from "next/navigation";
import { AuthorizationError } from "@/lib/auth/authorization";
/** Render an unavailable page for denied asset scope; retain real operational failures. */
export async function assetPageRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      (error instanceof Error && error.message.startsWith("MODULE_DISABLED:"))
    )
      notFound();
    throw error;
  }
}
