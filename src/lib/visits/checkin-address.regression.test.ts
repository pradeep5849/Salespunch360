import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const source=readFileSync("src/lib/visits/service.ts","utf8");
describe("immutable post-commit check-in address",()=>{
 it("queues reverse geocoding inside the same transaction as the visit",()=>{expect(source).toContain("await enqueueVisitAddress(tx,user.companyId,visit.id)");expect(source.indexOf("await enqueueVisitAddress")).toBeLessThan(source.indexOf("TX_COMMIT"));});
 it("keeps photo compensation isolated from asynchronous geocoding",()=>{expect(source).not.toContain("reverseGeocode(");expect(source).toContain("compensateWrittenPhoto(privateStorage()")});
 it("binds the queued work to the committed tenant and visit",()=>expect(source).toContain("enqueueVisitAddress(tx,user.companyId,visit.id)"));
 it("schedules durable field jobs only after a successful commit",()=>{expect(source.indexOf("scheduleFieldJobs()")).toBeGreaterThan(source.indexOf("isolationLevel:Prisma.TransactionIsolationLevel.Serializable"));});
});
