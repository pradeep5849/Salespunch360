import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({put:vi.fn(),update:vi.fn()}));
vi.mock("@/lib/storage",()=>({privateStorage:()=>({put:m.put})}));
vi.mock("@/lib/db",()=>({db:{company:{update:m.update}}}));
import {storeReplacementCompanyLogo} from "./logo-replacement";
beforeEach(()=>{vi.clearAllMocks();m.update.mockReset().mockResolvedValue({})});
it("writes a new immutable object before pointing the company at it",async()=>{const first=await storeReplacementCompanyLogo("company",Buffer.from("one")),second=await storeReplacementCompanyLogo("company",Buffer.from("two"));expect(first).not.toBe(second);expect(first).toMatch(/^companies\/company\/branding\/logos\/[0-9a-f-]+\.webp$/);expect(m.put.mock.invocationCallOrder[0]).toBeLessThan(m.update.mock.invocationCallOrder[0]);expect(m.update.mock.calls[0][0].data.logoObjectKey).toBe(first)});
it("does not overwrite the old object if the pointer update fails",async()=>{m.update.mockRejectedValueOnce(new Error("DB_FAILED"));await expect(storeReplacementCompanyLogo("company",Buffer.from("new"))).rejects.toThrow("DB_FAILED");expect(m.put.mock.calls[0][0]).not.toBe("Logo/company.webp");expect(m.put).toHaveBeenCalledOnce()});
