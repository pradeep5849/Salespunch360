import {afterEach,expect,it,vi} from "vitest";
import {createHash} from "node:crypto";
import {prepareBackupFile} from "./backup-transfer";
afterEach(()=>vi.unstubAllGlobals());
it("verifies bytes before preparing a downloadable backup",async()=>{
 const bytes='{"company":"example"}';
 const fetch=vi.fn().mockResolvedValue(new Response(bytes,{headers:{"content-type":"application/json","x-content-sha256":createHash("sha256").update(bytes).digest("hex")}}));vi.stubGlobal("fetch",fetch);
 const file=await prepareBackupFile(true);expect(await file.text()).toBe(bytes);expect(fetch).toHaveBeenCalledWith("/api/account/utilities/backup?includeFiles=true",{cache:"no-store"});
});
it("rejects a corrupted backup",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response('{}',{headers:{"content-type":"application/json","x-content-sha256":"bad"}})));await expect(prepareBackupFile()).rejects.toThrow("integrity verification failed")});
it("rejects an unauthorized response before preparing any file",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:403})));await expect(prepareBackupFile()).rejects.toThrow("permission")});
