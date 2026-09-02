import {afterEach,describe,expect,it,vi} from "vitest";
import {z} from "zod";

const mocks=vi.hoisted(()=>({fieldCheckIn:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/visits/service",()=>({fieldCheckIn:mocks.fieldCheckIn,addPhoneToVisit:vi.fn(),checkIn:vi.fn(),checkout:vi.fn()}));
import {fieldCheckInAction} from "./visits";
import {fieldCheckInErrorMessage} from "@/lib/visits/field-checkin-errors";

const form=()=>{const value=new FormData();value.set("visitType","NEW");value.set("name","Sensitive Person");value.set("phone","9999999999");value.set("latitude","12.3456");value.set("longitude","78.9012");value.set("accuracyMeters","5");value.set("photo",new File(["secret-photo-data"],"photo.jpg",{type:"image/jpeg"}));return value;};

afterEach(()=>vi.restoreAllMocks());

describe("field check-in action failures",()=>{
  it.each([
    ["ATTENDANCE_REQUIRED","Start attendance before check-in."],
    ["CHECKOUT_REQUIRED","Complete your current checkout before starting another check-in."],
    ["PHOTO_REQUIRED","A photo is required for this check-in."],
    ["PHOTO_INVALID","Unable to process this photo. Please take the photo again."],
    ["PHOTO_STORAGE_NOT_CONFIGURED","Photo storage is not configured yet. Please contact your administrator."],
    ["PHOTO_STORAGE_UNAVAILABLE","Photo storage is temporarily unavailable. Please try again later."],
    ["SUBJECT_OWNERSHIP_CONFLICT","This phone or subject requires assignment resolution."],
    ["SUBSCRIPTION_REQUIRED","Your subscription does not allow check-ins. Please contact your administrator."],
    ["CUSTOMER_NOT_FOUND","This customer is unavailable or is not assigned to you."],
    ["VISIT_NOT_FOUND","This visit or prospect is unavailable or is not assigned to you."],
    ["AUTHENTICATION_REQUIRED","Your session has expired. Please sign in again."],
    ["AUTHORIZATION_REQUIRED","You are not authorized to add this check-in."],
  ])("maps %s",(code,message)=>expect(fieldCheckInErrorMessage(new Error(code))).toBe(message));

  it("preserves the repeat-radius mapping",()=>{const error=Object.assign(new Error("REPEAT_VISIT_OUTSIDE_RADIUS"),{distanceMeters:52.4});expect(fieldCheckInErrorMessage(error)).toBe("You are outside the allowed 50 m check-in radius. Current distance: 52 m.")});

  it("maps Zod validation failures",()=>{const result=z.object({location:z.object({latitude:z.number()})}).safeParse({location:{latitude:"private"}});expect(result.success).toBe(false);if(!result.success)expect(fieldCheckInErrorMessage(result.error)).toBe("Check the required fields, GPS, and selected visit type.")});

  it("logs only safe diagnostics and no submitted values",async()=>{const error=Object.assign(new Error("database rejected Sensitive Person at /private/storage/photo.jpg"),{name:"PrismaClientKnownRequestError",code:"P2002"});mocks.fieldCheckIn.mockRejectedValueOnce(error);const logged=vi.spyOn(console,"error").mockImplementation(()=>undefined);expect(await fieldCheckInAction(form())).toMatchObject({ok:false});expect(logged).toHaveBeenCalledOnce();const serialized=JSON.stringify(logged.mock.calls[0][0]);expect(serialized).toContain("FIELD_CHECKIN_FAILED");expect(serialized).toContain("P2002");expect(serialized).toContain("NEW");for(const secret of ["Sensitive Person","9999999999","12.3456","78.9012","secret-photo-data","/private/storage/photo.jpg"])expect(serialized).not.toContain(secret);});
});
