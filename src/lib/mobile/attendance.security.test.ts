import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({company:vi.fn(),findAttendance:vi.fn(),createAttendance:vi.fn(),query:vi.fn(),entitlement:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:vi.fn(async(fn)=>fn({$queryRaw:mocks.query,company:{findUnique:mocks.company},attendance:{findFirst:mocks.findAttendance,create:mocks.createAttendance}}))}}));
vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:mocks.entitlement}));
import{mobileAttendanceAction}from"./attendance";import{mobileAttendanceSchema}from"./validation";import type{MobilePrincipal}from"./auth";
const user:MobilePrincipal={id:"sales",name:"Sales",email:"s@example.com",salesRole:"SALES",managerType:null,companyId:"company"};
const fresh=()=>({latitude:0,longitude:0,accuracyMeters:5,capturedAt:new Date()});
beforeEach(()=>{vi.clearAllMocks();mocks.findAttendance.mockResolvedValue(null);mocks.createAttendance.mockResolvedValue({id:"attendance",startedAt:new Date(),endedAt:null});mocks.company.mockResolvedValue({attendanceEnabled:true,gpsTrackingEnabled:true,attendanceGeofenceEnabled:false,attendanceReferenceLatitude:null,attendanceReferenceLongitude:null,attendanceGeofenceRadiusMeters:null})});
describe("mobile attendance start policy",()=>{
 it("rejects GPS-enabled start without location",async()=>await expect(mobileAttendanceAction(user,"START")).rejects.toThrow("GPS_REQUIRED"));
 it("allows GPS-enabled start with a fresh valid location",async()=>{await expect(mobileAttendanceAction(user,"START",fresh())).resolves.toMatchObject({id:"attendance"});expect(mocks.createAttendance).toHaveBeenCalled()});
 it("allows no location only when GPS and geofence are disabled",async()=>{mocks.company.mockResolvedValue({attendanceEnabled:true,gpsTrackingEnabled:false,attendanceGeofenceEnabled:false});await expect(mobileAttendanceAction(user,"START")).resolves.toMatchObject({id:"attendance"})});
 it("rejects geofenced start without location",async()=>{mocks.company.mockResolvedValue({attendanceEnabled:true,gpsTrackingEnabled:false,attendanceGeofenceEnabled:true,attendanceReferenceLatitude:1,attendanceReferenceLongitude:2,attendanceGeofenceRadiusMeters:100});await expect(mobileAttendanceAction(user,"START")).rejects.toThrow("GPS_REQUIRED")});
 it("rejects invalid coordinates at the API boundary",()=>expect(mobileAttendanceSchema.safeParse({action:"START",location:{latitude:91,longitude:0,accuracyMeters:5,capturedAt:new Date().toISOString()}}).success).toBe(false));
 it("rejects stale and future start locations",async()=>{await expect(mobileAttendanceAction(user,"START",{...fresh(),capturedAt:new Date(Date.now()-121_000)})).rejects.toThrow("CAPTURE_TIME_INVALID");await expect(mobileAttendanceAction(user,"START",{...fresh(),capturedAt:new Date(Date.now()+31_000)})).rejects.toThrow("CAPTURE_TIME_INVALID")});
});
