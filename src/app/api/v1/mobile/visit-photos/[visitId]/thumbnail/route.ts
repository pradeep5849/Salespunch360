import { db } from "@/lib/db";
import { authenticateMobileSalesToken, mobileCan } from "@/lib/mobile/auth";
import { privateStorage } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ visitId: string }> }) {
  try {
    const user = await authenticateMobileSalesToken(request.headers.get("authorization"));
    if (!mobileCan(user, "SALES_CHECK_INS")) return new Response("Not found", { status: 404 });
    const { visitId } = await params;
    const photo = await db.visitPhoto.findFirst({
      where: {
        visitId,
        companyId: user.companyId,
        ...(user.salesRole === "SALES"
          ? { visit: { userId: user.id } }
          : user.salesRole === "MANAGER"
            ? { visit: { OR: [{ userId: user.id }, { user: { salesRole: "SALES", salesAccessActive: true, managerId: user.id } }] } }
            : {}),
      },
      select: { thumbnailObjectKey: true, mimeType: true },
    });
    if (!photo) return new Response("Not found", { status: 404 });
    const data = await privateStorage().get(photo.thumbnailObjectKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
