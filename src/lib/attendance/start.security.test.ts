import{beforeEach,describe,expect,it,vi}from"vitest";
const mocks=vi.hoisted(()=>({role:vi.fn(),transaction:vi.fn(),query:vi.fn(),user:vi.fn(),company:vi.fn(),attendance:vi.fn(),create:vi.fn(),entitlement:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({requireRole:mocks.role}));vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:mocks.entitlement}));vi.mock("@/lib/db",()=>({db:{$transaction:mocks.transaction,geofenceEvent:{create:vi.fn()}}}));
import{startAttendance}from"./service";
beforeEach(()=>{vi.clearAllMocks();mocks.role.mockResolvedValue({id:"sales",role:"SALES",companyId:"company"});mocks.user.mockResolvedValue({id:"sales"});mocks.company.mockResolvedValue({attendanceEnabled:true,gpsTrackingEnabled:true,attendanceGeofenceEnabled:false,attendanceReferenceLatitude:null,attendanceReferenceLongitude:null,attendanceGeofenceRadiusMeters:null});mocks.attendance.mockResolvedValue(null);mocks.create.mockResolvedValue({id:"attendance"});mocks.transaction.mockImplementation(async(fn)=>fn({$queryRaw:mocks.query,user:{findFirst:mocks.user},company:{findFirst:mocks.company},attendance:{findFirst:mocks.attendance,create:mocks.create}}))});
describe("web attendance start authority",()=>{
 it("rejects missing location when authoritative company GPS is enabled",async()=>await expect(startAttendance({})).rejects.toThrow("GPS_REQUIRED"));
 it("accepts fresh valid zero coordinates",async()=>await expect(startAttendance({location:{latitude:0,longitude:0,accuracyMeters:0,capturedAt:new Date().toISOString()}})).resolves.toMatchObject({id:"attendance"}));
 it("allows no location when GPS and geofence are disabled",async()=>{mocks.company.mockResolvedValue({...await mocks.company(),gpsTrackingEnabled:false});await expect(startAttendance({})).resolves.toMatchObject({id:"attendance"})});
});
