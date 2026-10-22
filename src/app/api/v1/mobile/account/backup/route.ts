import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileBackup } from "@/lib/mobile/account-administration";
import {
  mobileAuthorizationFailure,
  mobileUnauthorized,
  mobileUnexpected,
  mobileJson,
} from "@/lib/mobile/http";
export async function GET(r: Request) {
  try {
    const x = await mobileBackup(
      await authenticateMobileToken(r.headers.get("authorization")),
      new URL(r.url).searchParams.get("includeFiles")==="true",
    );
    return new Response(x.bytes, {
      headers: {
        "content-type": "application/json",
        "cache-control":"private, no-store",
        "x-content-sha256":x.checksum,
        "content-disposition": `attachment; filename="${x.fileName}"`,
      },
    });
  } catch (e) {
    const code=e instanceof Error?e.message:"";
    const errors:Record<string,[number,string]>={BACKUP_FILE_UNAVAILABLE:[503,"A required private file is unavailable. Check storage and retry."],BACKUP_FILES_TOO_LARGE:[413,"Private files exceed the bundle limit. Use records plus provider storage backup."],BACKUP_FILE_SCOPE_INVALID:[409,"A private-file reference failed company validation."]};
    if(errors[code]){const [status,message]=errors[code];return mobileJson({error:code,message},status)}
    return (
      mobileUnauthorized(e) ??
      mobileAuthorizationFailure(e) ??
      mobileUnexpected("MOBILE_ACCOUNT_BACKUP", e)
    );
  }
}
