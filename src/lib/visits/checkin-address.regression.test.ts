import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const source=readFileSync("src/lib/visits/service.ts","utf8");
describe("immutable post-commit check-in address",()=>{
 it("does not reverse geocode inside the Prisma transaction",()=>{expect(source.indexOf("reverseGeocode(d.location.latitude")).toBeGreaterThan(source.indexOf("isolationLevel:Prisma.TransactionIsolationLevel.Serializable"));});
 it("keeps geocoding outside the photo compensation catch",()=>{expect(source.indexOf("reverseGeocode(d.location.latitude")).toBeGreaterThan(source.indexOf("compensateWrittenPhoto(privateStorage()"));});
 it("writes only the committed tenant/user visit and never overwrites a snapshot",()=>expect(source).toContain("where:{id:visitId,companyId:user.companyId,userId:user.id,checkInAddress:null}"));
 it("swallows the best-effort address update failure after a successful commit",()=>expect(source).toContain("data:{checkInAddress:address}}).catch(()=>undefined)"));
});
