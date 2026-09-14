import {beforeEach,describe,expect,it,vi} from "vitest";
import {z} from "zod";

const mocks=vi.hoisted(()=>({
  auth:vi.fn(),bootstrap:vi.fn(),fieldEnabled:vi.fn(),createSession:vi.fn(),revoke:vi.fn(),
  attendance:vi.fn(),upload:vi.fn(),companyContext:vi.fn(),companyUpdate:vi.fn(),
  employeeContext:vi.fn(),employeeCreate:vi.fn(),employeePatch:vi.fn(),registerPush:vi.fn(),
  fingerprint:vi.fn(),rateLimit:vi.fn(),findUser:vi.fn(),verifyPassword:vi.fn(),hashPassword:vi.fn(),replacePassword:vi.fn(),log:vi.fn(),
}));

vi.mock("@/lib/logging",()=>({logEvent:mocks.log}));
vi.mock("@/lib/mobile/auth",()=>({
  authenticateMobileToken:mocks.auth,mobileBootstrap:mocks.bootstrap,mobileFieldWorkEnabled:mocks.fieldEnabled,
  createMobileSession:mocks.createSession,revokeMobileToken:mocks.revoke,
}));
vi.mock("@/lib/mobile/attendance",()=>({mobileAttendanceAction:mocks.attendance,mobileUploadPoint:mocks.upload}));
vi.mock("@/lib/security/request",()=>({requestFingerprint:mocks.fingerprint,consumeRateLimit:mocks.rateLimit}));
vi.mock("@/lib/auth/crypto",()=>({verifyPassword:mocks.verifyPassword,hashPassword:mocks.hashPassword}));
vi.mock("@/lib/auth/session-generation",()=>({replacePasswordAndRevoke:mocks.replacePassword}));
vi.mock("@/lib/db",()=>({db:{user:{findFirst:mocks.findUser}}}));
vi.mock("@/lib/mobile/company",()=>{
  class MobileCompanyError extends Error{constructor(public code:string,public status=400){super(code)}}
  return{MobileCompanyError,mobileCompanyContext:mocks.companyContext,mobileUpdateCompany:mocks.companyUpdate};
});
vi.mock("@/lib/mobile/employees",()=>{
  class MobileEmployeeError extends Error{constructor(public code:string,public status=400){super(code)}}
  return{MobileEmployeeError,mobileEmployeeContext:mocks.employeeContext,mobileCreateEmployee:mocks.employeeCreate,mobileSetEmployeeActive:mocks.employeePatch};
});
vi.mock("@/lib/push/registration",()=>({registerPushDevice:mocks.registerPush}));

import {GET as attendanceGet} from "./attendance/route";
import {POST as locationPost} from "./locations/route";
import {GET as bootstrapGet} from "./bootstrap/route";
import {POST as loginPost} from "./auth/login/route";
import {POST as logoutPost} from "./auth/logout/route";
import {POST as passwordPost} from "./auth/password/route";
import {GET as companyGet} from "./company/route";
import {GET as employeesGet,POST as employeesPost} from "./employees/route";
import {POST as pushPost} from "./push/route";
import {MobileCompanyError} from "@/lib/mobile/company";
import {MobileEmployeeError} from "@/lib/mobile/employees";
import {EmployeePolicyError} from "@/lib/employees/policy";
import {OperationalBranchError} from "@/lib/branches/operational-scope";
import {Prisma} from "@prisma/client";

const secret="postgresql://user:password@private-db-host/database SQL failure /private/storage/key token=secret";
const headers={authorization:`Bearer ${"a".repeat(40)}`,"content-type":"application/json"};
const get=()=>new Request("http://localhost/api/v1/mobile/test",{headers});
const post=(body:unknown)=>new Request("http://localhost/api/v1/mobile/test",{method:"POST",headers,body:JSON.stringify(body)});
const validLogin=()=>post({identifier:"sales@example.com",password:"Password123"});
const validPoint=()=>post({clientPointId:crypto.randomUUID(),latitude:1,longitude:2,capturedAt:new Date().toISOString()});
async function expectSafe500(response:Response){const body=await response.json(),serialized=JSON.stringify(body),logs=JSON.stringify(mocks.log.mock.calls);expect(response.status).toBe(500);expect(body).toEqual({error:"SERVER_ERROR",referenceId:expect.stringMatching(/^[0-9a-f-]{36}$/)});for(const value of ["postgresql://","password","private-db-host","/private/storage","token=secret","SQL failure",secret]){expect(serialized).not.toContain(value);expect(logs).not.toContain(value)}expect(mocks.log).toHaveBeenCalled()}

describe("final mobile route error contract",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();mocks.auth.mockResolvedValue({salesRole:"SALES",managerType:null});mocks.fieldEnabled.mockReturnValue(true);
    mocks.bootstrap.mockResolvedValue({features:{fieldWorkEnabled:true},attendance:null});mocks.fingerprint.mockResolvedValue("fingerprint");mocks.rateLimit.mockResolvedValue(true);
  });

  it("separates Manager Only bootstrap access from the personal attendance endpoint",async()=>{
    mocks.auth.mockResolvedValue({salesRole:"MANAGER",managerType:"MANAGER_ONLY"});mocks.fieldEnabled.mockReturnValue(false);
    mocks.bootstrap.mockResolvedValue({features:{fieldWorkEnabled:false},attendance:null});
    const bootstrap=await bootstrapGet(get());expect(bootstrap.status).toBe(200);expect(await bootstrap.json()).toMatchObject({features:{fieldWorkEnabled:false},attendance:null});
    for(const managerType of ["MANAGER_ONLY",null]){mocks.auth.mockResolvedValue({salesRole:"MANAGER",managerType});const attendance=await attendanceGet(get());expect(attendance.status).toBe(403);expect(await attendance.json()).toEqual({error:"FORBIDDEN"})}
  });

  it("allows canonical field-capable Sales and Field Manager attendance reads",async()=>{
    mocks.bootstrap.mockResolvedValue({attendance:{id:"attendance-1",startedAt:"2026-09-13T00:00:00.000Z"}});
    for(const principal of [{salesRole:"SALES",managerType:null},{salesRole:"MANAGER",managerType:"FIELD_MANAGER"}]){mocks.auth.mockResolvedValue(principal);mocks.fieldEnabled.mockReturnValue(true);const response=await attendanceGet(get());expect(response.status).toBe(200);expect(await response.json()).toMatchObject({id:"attendance-1"})}
  });

  it("keeps expected login credential failure opaque but classifies infrastructure failure as 500",async()=>{
    mocks.createSession.mockRejectedValueOnce(new Error("INVALID_MOBILE_CREDENTIALS"));const invalid=await loginPost(validLogin());expect(invalid.status).toBe(401);expect(await invalid.json()).toEqual({error:"Unable to complete request."});
    mocks.rateLimit.mockResolvedValueOnce(false);const limited=await loginPost(validLogin());expect(limited.status).toBe(429);expect(await limited.json()).toEqual({error:"Too many attempts. Try again later."});
    mocks.createSession.mockRejectedValueOnce(new Error(secret));await expectSafe500(await loginPost(validLogin()));
  });

  it("keeps logout idempotent but does not report success when revocation storage fails",async()=>{
    mocks.revoke.mockResolvedValue(undefined);for(const authorization of [undefined,`Bearer ${"z".repeat(40)}`]){const response=await logoutPost(new Request("http://localhost/logout",{method:"POST",headers:authorization?{authorization}:{}}));expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true})}
    mocks.revoke.mockRejectedValue(new Error(secret));await expectSafe500(await logoutPost(get()));
  });

  it("returns safe 500 responses for unexpected attendance, location, and bootstrap failures",async()=>{
    mocks.bootstrap.mockRejectedValueOnce(new Error(secret));await expectSafe500(await attendanceGet(get()));
    mocks.upload.mockRejectedValueOnce(new Error(secret));await expectSafe500(await locationPost(validPoint()));
    mocks.bootstrap.mockRejectedValueOnce(new Error(secret));await expectSafe500(await bootstrapGet(get()));
  });

  it("returns safe 500 responses for unexpected company, employee, and push failures",async()=>{
    mocks.companyContext.mockRejectedValueOnce(new Error(secret));await expectSafe500(await companyGet(get()));
    mocks.employeeContext.mockRejectedValueOnce(new Error(secret));await expectSafe500(await employeesGet(get()));
    mocks.registerPush.mockRejectedValueOnce(new Error(secret));await expectSafe500(await pushPost(post({installationId:"installation-1234",fcmToken:"f".repeat(20)})));
  });

  it("preserves known company, employee, and push validation failures",async()=>{
    mocks.companyContext.mockRejectedValueOnce(new MobileCompanyError("FORBIDDEN",403));const company=await companyGet(get());expect(company.status).toBe(403);expect(await company.json()).toEqual({error:"FORBIDDEN"});
    mocks.employeeContext.mockRejectedValueOnce(new MobileEmployeeError("INVALID_ROLE",400));const employee=await employeesGet(get());expect(employee.status).toBe(400);expect(await employee.json()).toEqual({error:"INVALID_ROLE"});
    const validation=z.object({required:z.string()}).safeParse({});if(validation.success)throw new Error("expected invalid fixture");mocks.registerPush.mockRejectedValueOnce(validation.error);const push=await pushPost(post({}));expect(push.status).toBe(400);expect(await push.json()).toEqual({error:"INVALID_INPUT"});
  });

  it("normalizes every expected employee business and branch failure",async()=>{
    const cases:[unknown,number,string][]= [
      [new EmployeePolicyError("PHONE_IN_USE"),409,"PHONE_IN_USE"],[new EmployeePolicyError("NOT_FOUND"),404,"NOT_FOUND"],
      [new Error("INVALID_BRANCH"),400,"INVALID_BRANCH"],[new Error("BRANCH_REQUIRED"),400,"BRANCH_REQUIRED"],
      [new OperationalBranchError("BRANCH_FORBIDDEN"),403,"BRANCH_FORBIDDEN"],[new EmployeePolicyError("SEAT_LIMIT"),409,"SEAT_LIMIT"],
    ];
    for(const [error,status,code]of cases){mocks.employeeContext.mockRejectedValueOnce(error);const response=await employeesGet(get());expect(response.status).toBe(status);expect(await response.json()).toEqual({error:code})}
  });

  it.each(["same-company","cross-company"])("returns a private EMAIL_IN_USE conflict for %s duplicates",async()=>{mocks.employeeCreate.mockRejectedValueOnce(new EmployeePolicyError("EMAIL_IN_USE"));const response=await employeesPost(post({role:"SALES"})),body=await response.json(),serialized=JSON.stringify(body);expect(response.status).toBe(409);expect(body).toEqual({error:"EMAIL_IN_USE"});for(const detail of ["company-a","company-b","user-id","Existing User","SALES","P2002"])expect(serialized).not.toContain(detail)});
  it("keeps unrelated P2002 failures on the safe unexpected path",async()=>{mocks.employeeCreate.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("duplicate phone",{code:"P2002",clientVersion:"6.12.0",meta:{target:["phone"]}}));await expectSafe500(await employeesPost(post({role:"SALES"})))});

  it("preserves password statuses and makes database failures safe",async()=>{
    const body={currentPassword:"OldPassword1",newPassword:"NewPassword123",confirmPassword:"NewPassword123"};
    mocks.auth.mockRejectedValueOnce(new Error("MOBILE_UNAUTHORIZED"));const unauthorized=await passwordPost(post(body));expect(unauthorized.status).toBe(401);expect(await unauthorized.json()).toEqual({error:"UNAUTHORIZED"});
    const invalid=await passwordPost(post({...body,confirmPassword:"different"}));expect(invalid.status).toBe(400);expect(await invalid.json()).toEqual({error:"INVALID_INPUT"});
    mocks.findUser.mockResolvedValueOnce({passwordHash:"hash"});mocks.verifyPassword.mockResolvedValueOnce(false);const wrong=await passwordPost(post(body));expect(wrong.status).toBe(403);expect(await wrong.json()).toEqual({error:"CURRENT_PASSWORD_INCORRECT"});
    mocks.findUser.mockRejectedValueOnce(new Error(secret));await expectSafe500(await passwordPost(post(body)));
  });
});
