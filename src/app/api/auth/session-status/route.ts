import { getAuthenticatedUser } from "@/lib/auth/session";
import { authenticatedHome } from "@/lib/auth/routing";
/** Recovery checks existing cookie authentication only; never creates a session. */
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    return Response.json(
      {
        authenticated: Boolean(user),
        ...(user ? { redirectTo: authenticatedHome(user) } : {}),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Session confirmation is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
