import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { privateStorage } from "@/lib/storage";

export const GOOGLE_BACKUP_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_BACKUP_CALLBACK = "/api/account/backup/google/callback";
export const GOOGLE_BACKUP_COOKIE = "sp360_google_backup";
const connectionSchema = z.object({
  companyId: z.string(),
  refreshToken: z.string().min(1),
  email: z.string().email(),
  folderId: z.string().min(1),
  connectedAt: z.string().datetime(),
});
const stateSchema = z.object({
  companyId: z.string(),
  userId: z.string(),
  nonce: z.string(),
  verifier: z.string(),
  expiresAt: z.number(),
});
type Connection = z.infer<typeof connectionSchema>;
export type GoogleBackupStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
};
export function googleBackupConfigured() {
  return Boolean(
    process.env.GOOGLE_BACKUP_CLIENT_ID &&
    process.env.GOOGLE_BACKUP_CLIENT_SECRET,
  );
}
function configuration() {
  if (!googleBackupConfigured())
    throw new Error("GOOGLE_DRIVE_BACKUP_NOT_CONFIGURED");
  return {
    client_id: process.env.GOOGLE_BACKUP_CLIENT_ID!,
    client_secret: process.env.GOOGLE_BACKUP_CLIENT_SECRET!,
    redirect_uri: new URL(GOOGLE_BACKUP_CALLBACK, env.APP_URL).href,
  };
}
function key() {
  return createHash("sha256")
    .update("salespunch360:google-backup:v1\0" + env.AUTH_SECRET)
    .digest();
}
/** Domain-separated, authenticated encryption; neither credentials nor OAuth state enter business exports. */
export function sealGoogleBackup(value: unknown, purpose: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(purpose));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
}
export function openGoogleBackup(value: string, purpose: string): unknown {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < 29) throw new Error("GOOGLE_BACKUP_INVALID_STATE");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    bytes.subarray(0, 12),
  );
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  );
}
const objectKey = (companyId: string) =>
  `companies/${encodeURIComponent(companyId)}/backup-connections/google-drive.enc`;
async function connection(companyId: string): Promise<Connection> {
  try {
    const data = connectionSchema.parse(
      openGoogleBackup(
        (await privateStorage().get(objectKey(companyId))).toString("utf8"),
        `connection:${companyId}`,
      ),
    );
    if (data.companyId !== companyId) throw new Error();
    return data;
  } catch {
    throw new Error("GOOGLE_DRIVE_BACKUP_NOT_CONNECTED");
  }
}
export async function googleBackupStatus(
  companyId: string,
): Promise<GoogleBackupStatus> {
  if (!googleBackupConfigured()) return { configured: false, connected: false };
  try {
    const value = await connection(companyId);
    return { configured: true, connected: true, email: value.email };
  } catch {
    return { configured: true, connected: false };
  }
}
export async function assertGoogleBackupConnected(companyId: string) {
  configuration();
  await connection(companyId);
}
export function beginGoogleBackup(companyId: string, userId: string) {
  const config = configuration(),
    nonce = randomBytes(32).toString("base64url"),
    verifier = randomBytes(32).toString("base64url");
  const cookie = sealGoogleBackup(
    { companyId, userId, nonce, verifier, expiresAt: Date.now() + 600_000 },
    "oauth-state",
  );
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.client_id,
    redirect_uri: config.redirect_uri,
    response_type: "code",
    scope: GOOGLE_BACKUP_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return { url: url.href, cookie };
}
export function validateGoogleBackupState(
  cookie: string,
  nonce: string,
  companyId: string,
  userId: string,
) {
  const state = stateSchema.parse(openGoogleBackup(cookie, "oauth-state"));
  const a = Buffer.from(state.nonce),
    b = Buffer.from(nonce);
  if (
    a.length !== b.length ||
    !timingSafeEqual(a, b) ||
    state.expiresAt < Date.now() ||
    state.companyId !== companyId ||
    state.userId !== userId
  )
    throw new Error("GOOGLE_BACKUP_INVALID_STATE");
  return state;
}
async function googleFetch(url: string, init: RequestInit = {}) {
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new Error("GOOGLE_DRIVE_BACKUP_UNAVAILABLE");
  }
}
async function token(parameters: Record<string, string>) {
  const config = configuration();
  const response = await googleFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ ...config, ...parameters }),
  });
  if (!response.ok) throw new Error("GOOGLE_DRIVE_BACKUP_RECONNECT_REQUIRED");
  return z
    .object({
      access_token: z.string().min(1),
      refresh_token: z.string().optional(),
      scope: z.string().optional(),
    })
    .parse(await response.json());
}
const drive = "https://www.googleapis.com/drive/v3";
async function driveJson(path: string, access: string, init: RequestInit = {}) {
  const response = await googleFetch(`${drive}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${access}`, ...init.headers },
  });
  if (!response.ok) throw new Error("GOOGLE_DRIVE_BACKUP_UNAVAILABLE");
  return response.json();
}
export async function finishGoogleBackup(
  code: string,
  state: ReturnType<typeof validateGoogleBackupState>,
) {
  const result = await token({
    grant_type: "authorization_code",
    code,
    code_verifier: state.verifier,
  });
  if (
    !result.refresh_token ||
    !result.scope?.split(" ").includes(GOOGLE_BACKUP_SCOPE)
  )
    throw new Error("GOOGLE_DRIVE_BACKUP_RECONNECT_REQUIRED");
  const about = z
    .object({ user: z.object({ emailAddress: z.string().email() }) })
    .parse(
      await driveJson("/about?fields=user(emailAddress)", result.access_token),
    );
  const folder = z
    .object({ id: z.string().min(1) })
    .parse(
      await driveJson("/files?fields=id", result.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "SalesPunch360 Backups",
          mimeType: "application/vnd.google-apps.folder",
          appProperties: { salespunch360Company: state.companyId },
        }),
      }),
    );
  const value: Connection = {
    companyId: state.companyId,
    refreshToken: result.refresh_token,
    email: about.user.emailAddress,
    folderId: folder.id,
    connectedAt: new Date().toISOString(),
  };
  await privateStorage().put(
    objectKey(state.companyId),
    Buffer.from(sealGoogleBackup(value, `connection:${state.companyId}`)),
  );
}
/** Success is returned only after Drive confirms file size and the uploaded content checksum. */
export async function uploadGoogleBackup(
  companyId: string,
  backup: { id: string; fileName: string; bytes: Uint8Array; checksum: string },
) {
  if (
    createHash("sha256").update(backup.bytes).digest("hex") !== backup.checksum
  )
    throw new Error("GOOGLE_DRIVE_BACKUP_INTEGRITY_FAILED");
  const saved = await connection(companyId),
    credentials = await token({
      grant_type: "refresh_token",
      refresh_token: saved.refreshToken,
    });
  const ids = z
    .object({ ids: z.array(z.string()).min(1) })
    .parse(
      await driveJson(
        "/files/generateIds?count=1&space=drive&type=files",
        credentials.access_token,
      ),
    );
  const fileId = ids.ids[0],
    boundary = `sp360_${randomBytes(16).toString("hex")}`;
  const metadata = {
    id: fileId,
    name: backup.fileName,
    parents: [saved.folderId],
    mimeType: "application/json",
    appProperties: {
      backupId: backup.id,
      sha256: backup.checksum,
      salespunch360Company: companyId,
    },
  };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
    ),
    Buffer.from(backup.bytes),
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  // A generated file ID lets us check the outcome even if the upload response is lost.
  try {
    await googleFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: new Uint8Array(body).buffer,
      },
    );
  } catch {
    /* Verify remotely below. Never infer success from a network response. */
  }
  const remote = z
    .object({
      id: z.string(),
      size: z.string(),
      md5Checksum: z.string(),
      trashed: z.boolean().optional(),
      appProperties: z.object({
        sha256: z.string(),
        backupId: z.string(),
        salespunch360Company: z.string(),
      }),
    })
    .parse(
      await driveJson(
        `/files/${encodeURIComponent(fileId)}?fields=id,size,md5Checksum,trashed,appProperties`,
        credentials.access_token,
      ),
    );
  if (
    remote.trashed ||
    remote.id !== fileId ||
    Number(remote.size) !== backup.bytes.byteLength ||
    remote.md5Checksum !==
      createHash("md5").update(backup.bytes).digest("hex") ||
    remote.appProperties.sha256 !== backup.checksum ||
    remote.appProperties.backupId !== backup.id ||
    remote.appProperties.salespunch360Company !== companyId
  )
    throw new Error("GOOGLE_DRIVE_BACKUP_INTEGRITY_FAILED");
  return {
    provider: "GOOGLE_DRIVE" as const,
    driveFileId: fileId,
    uploadedAt: new Date().toISOString(),
  };
}
