import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({authorized:vi.fn(),purge:vi.fn()}));
vi.mock("@/lib/field-jobs/service",()=>({authorizedJobRunner:m.authorized}));
vi.mock("@/lib/account/recycle-retention",()=>({purgeExpiredRecycleRecords:m.purge}));
import {POST} from "./route";
beforeEach(()=>{vi.clearAllMocks();m.purge.mockResolvedValue({processed:0,active:false})});
it("does not run deletion for an unauthenticated caller",async()=>{m.authorized.mockReturnValue(false);expect((await POST(new Request("https://example.test",{method:"POST"}))).status).toBe(401);expect(m.purge).not.toHaveBeenCalled()});
it("uses the server retention policy without accepting caller dates or IDs",async()=>{m.authorized.mockReturnValue(true);const response=await POST(new Request("https://example.test",{method:"POST",headers:{authorization:"Bearer fixture"},body:JSON.stringify({now:"2099-01-01",limit:100000})}));expect(response.status).toBe(200);expect(m.purge).toHaveBeenCalledWith();expect(response.headers.get("Cache-Control")).toBe("no-store")});
