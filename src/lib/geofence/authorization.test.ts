import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({read:vi.fn(),mutation:vi.fn(),find:vi.fn(),update:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({requirePermission:mocks.read,requirePermissionForMutation:mocks.mutation}));
vi.mock("@/lib/db",()=>({db:{company:{findUnique:mocks.find,update:mocks.update}}}));
import {getGeofenceSettings,updateGeofenceSettings} from "./service";
const valid={attendanceGeofenceEnabled:false,attendanceReferenceLatitude:null,attendanceReferenceLongitude:null,attendanceGeofenceRadiusMeters:null,customerCheckInGeofenceEnabled:false,customerCheckInGeofenceRadiusMeters:null};
describe("geofence settings canonical authorization",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.read.mockResolvedValue({companyId:"company-1",salesRole:"PRIMARY_ADMIN"});mocks.mutation.mockResolvedValue({companyId:"company-1",salesRole:"PRIMARY_ADMIN"});mocks.find.mockResolvedValue(valid);mocks.update.mockResolvedValue(valid)});
 it("uses SALES_SETTINGS for read and mutation boundaries",async()=>{await getGeofenceSettings();await updateGeofenceSettings(valid);expect(mocks.read).toHaveBeenCalledWith("SALES_SETTINGS");expect(mocks.mutation).toHaveBeenCalledWith("SALES_SETTINGS")});
 it("allows the canonically authorized Primary Admin",async()=>{await expect(getGeofenceSettings()).resolves.toEqual(valid);await expect(updateGeofenceSettings(valid)).resolves.toEqual(valid)});
 it.each(["ADMIN","MANAGER","SALES","null sales role","suspended Sales","account only","legacy FIELD_ADMIN alone"])("fails closed for %s",async reason=>{mocks.read.mockRejectedValueOnce(new Error(reason));mocks.mutation.mockRejectedValueOnce(new Error(reason));await expect(getGeofenceSettings()).rejects.toThrow(reason);await expect(updateGeofenceSettings(valid)).rejects.toThrow(reason);expect(mocks.find).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled()});
});
