import {beforeEach,it,expect,vi} from "vitest";
import {AuthorizationError} from "@/lib/auth/authorization";
const m=vi.hoisted(()=>({auth:vi.fn(),backup:vi.fn()}));
vi.mock("@/lib/mobile/auth",()=>({authenticateMobileToken:m.auth}));
vi.mock("@/lib/mobile/account-administration",()=>({mobileBackup:m.backup}));
import {GET} from "./route";
beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({id:"admin"});m.backup.mockResolvedValue({bytes:new TextEncoder().encode('{}'),fileName:'backup.json',checksum:'digest'})});
it("authenticates and explicitly forwards private-file selection with private checksum headers",async()=>{
 for(const include of [false,true]){const response=await GET(new Request(`https://app.test/api/v1/mobile/account/backup${include?'?includeFiles=true':''}`,{headers:{authorization:'Bearer test'}}));expect(response.status).toBe(200);expect(m.auth).toHaveBeenCalledWith('Bearer test');expect(m.backup).toHaveBeenLastCalledWith({id:'admin'},include);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(response.headers.get('x-content-sha256')).toBe('digest')}
});
it("denies unauthenticated and unauthorized backups",async()=>{m.auth.mockRejectedValueOnce(new Error('MOBILE_UNAUTHORIZED'));expect((await GET(new Request('https://app.test/api'))).status).toBe(401);expect(m.backup).not.toHaveBeenCalled();m.backup.mockRejectedValueOnce(new AuthorizationError());expect((await GET(new Request('https://app.test/api'))).status).toBe(403)});
it("returns actionable bounded-file failures without storage details",async()=>{for(const [code,status] of [['BACKUP_FILE_UNAVAILABLE',503],['BACKUP_FILES_TOO_LARGE',413],['BACKUP_FILE_SCOPE_INVALID',409]] as const){m.backup.mockRejectedValueOnce(new Error(code));const response=await GET(new Request('https://app.test/api'));expect(response.status).toBe(status);expect(await response.json()).toMatchObject({error:code});expect(response.headers.get('cache-control')).toBe('no-store')}});
