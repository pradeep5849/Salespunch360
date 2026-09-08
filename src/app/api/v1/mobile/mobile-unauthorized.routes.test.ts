import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({auth:vi.fn(),attendance:vi.fn(),upload:vi.fn(),report:vi.fn()}));
vi.mock("@/lib/mobile/auth",()=>({authenticateMobileToken:mocks.auth,mobileBootstrap:vi.fn()}));
vi.mock("@/lib/mobile/attendance",()=>({mobileAttendanceAction:mocks.attendance,mobileUploadPoint:mocks.upload}));
vi.mock("@/lib/mobile/reports",()=>({mobileReport:mocks.report}));

import { POST as attendance } from "./attendance/route";
import { GET as bootstrap } from "./bootstrap/route";
import { GET as company } from "./company/route";
import { GET as employees } from "./employees/route";
import { GET as field } from "./field/route";
import { POST as locations } from "./locations/route";
import { POST as push } from "./push/route";
import { GET as reports } from "./reports/route";
import { GET as targets } from "./targets/route";

const get=()=>new Request("http://localhost/api/v1/mobile/test",{headers:{authorization:"Bearer invalid-token-value-that-is-long-enough"}});
const post=(body:unknown)=>new Request("http://localhost/api/v1/mobile/test",{method:"POST",headers:{authorization:"Bearer invalid-token-value-that-is-long-enough","content-type":"application/json"},body:JSON.stringify(body)});

describe("authenticated mobile route status contract",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockRejectedValue(new Error("MOBILE_UNAUTHORIZED"))});
  it.each([
    ["attendance",()=>attendance(post({action:"START"}))],
    ["locations",()=>locations(post({clientPointId:crypto.randomUUID(),latitude:1,longitude:2,capturedAt:new Date().toISOString()}))],
    ["reports",()=>reports(get())],["field",()=>field(get())],["employees",()=>employees(get())],
    ["company",()=>company(get())],["targets",()=>targets(get())],["push",()=>push(post({}))],["bootstrap",()=>bootstrap(get())],
  ] as const)("returns 401 for %s when authentication fails",async(_name,call)=>expect((await call()).status).toBe(401));
  it("preserves attendance, location, and report domain statuses",async()=>{mocks.auth.mockResolvedValue({});mocks.attendance.mockRejectedValue(new Error("GPS_REQUIRED"));expect((await attendance(post({action:"START",location:{latitude:1,longitude:2,capturedAt:new Date().toISOString()}}))).status).toBe(409);mocks.upload.mockRejectedValue(new Error("THROTTLED"));expect((await locations(post({clientPointId:crypto.randomUUID(),latitude:1,longitude:2,capturedAt:new Date().toISOString()}))).status).toBe(409);mocks.report.mockRejectedValue(new Error("INVALID_REPORT"));expect((await reports(get())).status).toBe(400)});
});
