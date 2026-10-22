import {beforeEach,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({backup:vi.fn()}));
vi.mock("@/lib/account/utilities",()=>({createAccountBackup:m.backup}));
import {GET} from "./route";
beforeEach(()=>vi.resetAllMocks());
it("keeps existing record export and explicitly selects a private-file bundle",async()=>{
 m.backup.mockResolvedValue({bytes:new TextEncoder().encode('{}'),fileName:'backup.json',checksum:'digest'});
 for(const include of [false,true]){const response=await GET(new Request(`https://app.test/api/account/utilities/backup${include?'?includeFiles=true':''}`));expect(response.status).toBe(200);expect(m.backup).toHaveBeenLastCalledWith(include);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(response.headers.get('x-content-sha256')).toBe('digest')}
});
it("returns bounded actionable errors without private keys",async()=>{
 for(const [code,status] of [['BACKUP_FILE_UNAVAILABLE',503],['BACKUP_FILES_TOO_LARGE',413],['BACKUP_FILE_SCOPE_INVALID',409]] as const){m.backup.mockRejectedValueOnce(new Error(code));const response=await GET(new Request('https://app.test/api/account/utilities/backup?includeFiles=true'));expect(response.status).toBe(status);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(await response.text()).not.toContain('companies/')}
});
it("preserves authorization failures instead of converting them to successful exports",async()=>{const denied=new Error('UNAUTHORIZED');m.backup.mockRejectedValueOnce(denied);await expect(GET(new Request('https://app.test/api/account/utilities/backup?includeFiles=true'))).rejects.toBe(denied)});
