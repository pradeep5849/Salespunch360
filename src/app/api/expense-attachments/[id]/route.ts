import { downloadExpenseAttachment } from "@/lib/account/expenses";
import { AuthorizationError } from "@/lib/auth/authorization";
import { isRedirectError } from "next/dist/client/components/redirect-error";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const row = await downloadExpenseAttachment((await params).id);
    return new Response(new Uint8Array(row.data), {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const forbidden =
      error instanceof AuthorizationError ||
      (error instanceof Error && error.message.startsWith("MODULE_DISABLED:"));
    return Response.json(
      {
        error: forbidden
          ? "Attachment access denied."
          : "Attachment could not be retrieved. Try again.",
      },
      {
        status: forbidden ? 403 : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
