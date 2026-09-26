import { db } from "@/lib/db";
import { authenticateMobileSalesToken } from "@/lib/mobile/auth";
import { privateStorage } from "@/lib/storage";
import { authorizedVisitPhoto } from "@/lib/visits/photo-access";

function photoResponse(data: Buffer, mimeType: string) {
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function mobileAuthorizedPhoto(request: Request, visitId: string) {
  const user = await authenticateMobileSalesToken(request.headers.get("authorization"));
  const photo = await db.visitPhoto.findFirst({
    where: {
      visitId,
      companyId: user.companyId,
      ...(user.salesRole === "SALES"
        ? { visit: { userId: user.id } }
        : user.salesRole === "MANAGER"
          ? {
              visit: {
                OR: [
                  { userId: user.id },
                  { user: { salesRole: "SALES", salesAccessActive: true, managerId: user.id } },
                ],
              },
            }
          : {}),
    },
    select: { thumbnailObjectKey: true, mimeType: true },
  });
  if (!photo) throw new Error("PHOTO_NOT_FOUND");
  return photoResponse(await privateStorage().get(photo.thumbnailObjectKey), photo.mimeType);
}

export async function GET(request: Request, { params }: { params: Promise<{ visitId: string }> }) {
  try {
    const { visitId } = await params;
    if (request.headers.get("authorization")?.startsWith("Bearer ")) {
      return await mobileAuthorizedPhoto(request, visitId);
    }
    const photo = await authorizedVisitPhoto(visitId, true);
    return photoResponse(photo.data, photo.mimeType);
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
