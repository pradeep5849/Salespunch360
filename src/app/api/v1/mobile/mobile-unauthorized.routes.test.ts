import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({auth:vi.fn(),attendance:vi.fn(),upload:vi.fn(),report:vi.fn(),fieldContext:vi.fn(),fieldCheckIn:vi.fn()}));
vi.mock("@/lib/mobile/auth",()=>({authenticateMobileSalesToken:mocks.auth,authenticateMobileToken:mocks.auth,mobileBootstrap:vi.fn(),mobileFieldWorkEnabled:vi.fn()}));
vi.mock("@/lib/mobile/attendance",()=>({mobileAttendanceAction:mocks.attendance,mobileUploadPoint:mocks.upload}));
vi.mock("@/lib/mobile/reports",()=>({mobileReport:mocks.report}));
vi.mock("@/lib/mobile/field",()=>{class MobileFieldError extends Error{constructor(public code:string,public status=400){super(code)}}return{MobileFieldError,mobileFieldContext:mocks.fieldContext,mobileCheckIn:mocks.fieldCheckIn,mobileCheckout:vi.fn(),mobileFieldCheckIn:vi.fn()}});

import { POST as attendance } from "./attendance/route";
import { GET as bootstrap } from "./bootstrap/route";
import { GET as company } from "./company/route";
import { GET as employees } from "./employees/route";
import { GET as field, POST as fieldPost } from "./field/route";
import { POST as locations } from "./locations/route";
import { POST as push } from "./push/route";
import { GET as reports } from "./reports/route";
import { GET as targets } from "./targets/route";
import {OperationalBranchError} from "@/lib/branches/operational-scope";

const get=()=>new Request("http://localhost/api/v1/mobile/test",{headers:{authorization:"Bearer invalid-token-value-that-is-long-enough"}});
const post=(body:unknown)=>new Request("http://localhost/api/v1/mobile/test",{method:"POST",headers:{authorization:"Bearer invalid-token-value-that-is-long-enough","content-type":"application/json"},body:JSON.stringify(body)});

describe("authenticated mobile route status contract",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockRejectedValue(new Error("MOBILE_UNAUTHORIZED"))});
  it.each([
    ["attendance",()=>attendance(post({action:"START"}))],
    ["locations",()=>locations(post({clientPointId:crypto.randomUUID(),latitude:1,longitude:2,capturedAt:new Date().toISOString()}))],
    ["reports",()=>reports(get())],["field",()=>field(get())],["employees",()=>employees(get())],
    ["company",()=>company(get())],["targets",()=>targets(get())],["push",()=>push(post({}))],["bootstrap",()=>bootstrap(get())],
  ] as const)("returns the public 401 body for %s when authentication fails",async(_name,call)=>{const response=await call(),body=await response.json();expect(response.status).toBe(401);expect(body).toEqual({error:"UNAUTHORIZED"});expect(JSON.stringify(body)).not.toContain("MOBILE_UNAUTHORIZED")});
  it("returns 403 for an authenticated Account-only principal on representative Sales routes",async()=>{mocks.auth.mockRejectedValue(new Error("MOBILE_FORBIDDEN"));for(const call of [()=>attendance(post({action:"START"})),()=>locations(post({clientPointId:crypto.randomUUID(),latitude:1,longitude:2,capturedAt:new Date().toISOString()})),()=>reports(get()),()=>field(get()),()=>employees(get()),()=>company(get()),()=>targets(get())]){const response=await call();expect(response.status).toBe(403);expect(await response.json()).toEqual({error:"FORBIDDEN"})}});
  it("preserves attendance, location, and report domain statuses and bodies",async()=>{mocks.auth.mockResolvedValue({});mocks.attendance.mockRejectedValue(new Error("GPS_REQUIRED"));const attendanceResponse=await attendance(post({action:"START",location:{latitude:1,longitude:2,capturedAt:new Date().toISOString()}}));expect(attendanceResponse.status).toBe(409);expect(await attendanceResponse.json()).toEqual({error:"GPS_REQUIRED"});mocks.upload.mockRejectedValue(new Error("THROTTLED"));const locationResponse=await locations(post({clientPointId:crypto.randomUUID(),latitude:1,longitude:2,capturedAt:new Date().toISOString()}));expect(locationResponse.status).toBe(409);expect(await locationResponse.json()).toEqual({error:"THROTTLED"});mocks.report.mockRejectedValue(new Error("INVALID_REPORT"));const reportResponse=await reports(get());expect(reportResponse.status).toBe(400);expect(await reportResponse.json()).toEqual({error:"INVALID_REPORT"})});
  it("fails closed for field-ineligible actors without leaking unexpected errors",async()=>{mocks.auth.mockResolvedValue({});mocks.attendance.mockRejectedValue(new Error("MOBILE_FORBIDDEN"));const forbidden=await attendance(post({action:"START"}));expect(forbidden.status).toBe(403);expect(await forbidden.json()).toEqual({error:"FORBIDDEN"});mocks.upload.mockRejectedValue(new Error("private database host"));const unexpected=await locations(post({clientPointId:crypto.randomUUID(),latitude:1,longitude:2,capturedAt:new Date().toISOString()}));expect(unexpected.status).toBe(500);expect(await unexpected.json()).toMatchObject({error:"SERVER_ERROR",referenceId:expect.any(String)})});
  it("normalizes real operational branch errors on attendance and field routes",async()=>{mocks.auth.mockResolvedValue({});for(const [code,status]of [["BRANCH_REQUIRED",400],["BRANCH_FORBIDDEN",403]]as const){mocks.attendance.mockRejectedValueOnce(new OperationalBranchError(code));const response=await attendance(post({action:"START"}));expect(response.status).toBe(status);expect(await response.json()).toEqual({error:code})}mocks.fieldContext.mockRejectedValueOnce(new OperationalBranchError("BRANCH_FORBIDDEN"));const response=await field(get());expect(response.status).toBe(403);expect(await response.json()).toEqual({error:"BRANCH_FORBIDDEN"})});
  it("returns the frozen subscription conflict for field CHECK_IN",async()=>{mocks.auth.mockResolvedValue({});mocks.fieldCheckIn.mockRejectedValueOnce(new Error("SUBSCRIPTION_REQUIRED"));const response=await fieldPost(post({action:"CHECK_IN"}));expect(response.status).toBe(409);expect(await response.json()).toEqual({error:"SUBSCRIPTION_REQUIRED"})});
});
