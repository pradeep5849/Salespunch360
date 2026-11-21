import {beforeEach,expect,it,vi} from "vitest";
import {Prisma} from "@prisma/client";
vi.mock("@/lib/location/travel-route",()=>({calculateTravelDistanceMeters:(rows:unknown[])=>rows.length>0?10000:0}));
import {refreshStoppedTravelDay} from "./daily-snapshot";
const m={employee:vi.fn(),existing:vi.fn(),company:vi.fn(),points:vi.fn(),save:vi.fn(),lock:vi.fn()};
const tx={$queryRaw:m.lock,user:{findFirst:m.employee},dailyTravelApproval:{findUnique:m.existing,upsert:m.save},company:{findUnique:m.company},locationPoint:{findMany:m.points}} as unknown as Prisma.TransactionClient;
const point=(attendanceId:string)=>({attendanceId,latitude:0,longitude:0,capturedAt:new Date(),accuracyMeters:5});
beforeEach(()=>{vi.clearAllMocks();m.employee.mockResolvedValue({travelAllowanceEnabled:true,travelApprovalMode:"AUTO",travelRatePerKm:new Prisma.Decimal(5)});m.existing.mockResolvedValue(null);m.company.mockResolvedValue({travelRatePerKm:new Prisma.Decimal(5)});m.points.mockResolvedValue([point("morning")]);m.save.mockResolvedValue({})});
it("10km morning plus 10km evening replaces the daily total with 20km, not 30km",async()=>{
 await refreshStoppedTravelDay(tx,"company","branch","employee","2026-11-21");expect(m.save.mock.calls[0][0].create.distanceMeters).toBe(10000);
 m.existing.mockResolvedValue({distanceMeters:10000,ratePerKm:new Prisma.Decimal(5),status:"APPROVED",reviewedByUserId:null});m.points.mockResolvedValue([point("morning"),point("evening")]);
 await refreshStoppedTravelDay(tx,"company","branch","employee","2026-11-21");await refreshStoppedTravelDay(tx,"company","branch","employee","2026-11-21");
 for(const call of m.save.mock.calls.slice(1)){expect(call[0].update.distanceMeters).toBe(20000);expect(call[0].update.amount.toString()).toBe("100")}
 expect(m.points.mock.calls[0][0].where.attendance).toEqual({endedAt:{not:null}});
});
it("does not join routes across attendance sessions and uses IST day boundaries",async()=>{await refreshStoppedTravelDay(tx,"company","branch","employee","2026-11-21");expect(m.points.mock.calls[0][0].where.capturedAt).toEqual({gte:new Date("2026-11-20T18:30Z"),lt:new Date("2026-11-21T18:30Z")})});
it("preserves explicit manual decisions and a saved day rate",async()=>{m.existing.mockResolvedValue({ratePerKm:new Prisma.Decimal(2),status:"APPROVED",reviewedByUserId:"reviewer"});await refreshStoppedTravelDay(tx,"c","b","e","2026-11-21");expect(m.save).not.toHaveBeenCalled();m.existing.mockResolvedValue({ratePerKm:new Prisma.Decimal(2),status:"APPROVED",reviewedByUserId:null});await refreshStoppedTravelDay(tx,"c","b","e","2026-11-21");expect(m.save.mock.calls[0][0].update.ratePerKm.toString()).toBe("2")});
it("leaves manual-mode updates pending rather than approving on a report read",async()=>{m.employee.mockResolvedValue({travelAllowanceEnabled:true,travelApprovalMode:"MANUAL",travelRatePerKm:new Prisma.Decimal(5)});await refreshStoppedTravelDay(tx,"c","b","e","2026-11-21");expect(m.save.mock.calls[0][0].create.status).toBe("PENDING")});
