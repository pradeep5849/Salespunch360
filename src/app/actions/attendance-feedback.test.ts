import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({start:vi.fn(),end:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/attendance/service",()=>({startAttendance:m.start,endAttendance:m.end,uploadLocationPoint:vi.fn(),updateCompanyOperations:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:m.revalidate}));
import {startAttendanceAction,endAttendanceAction} from "./attendance";
beforeEach(()=>{vi.clearAllMocks()});
it("returns persisted server start time instead of client clock time",async()=>{m.start.mockResolvedValue({startedAt:new Date("2026-11-21T04:00:00Z")});expect(await startAttendanceAction()).toMatchObject({ok:true,confirmedAt:"2026-11-21T04:00:00.000Z"})});
it("returns persisted server stop time",async()=>{m.end.mockResolvedValue({endedAt:new Date("2026-11-21T05:00:00Z")});expect(await endAttendanceAction()).toMatchObject({ok:true,confirmedAt:"2026-11-21T05:00:00.000Z"})});
it("never supplies a success timestamp after start or stop failure",async()=>{m.start.mockRejectedValue(new Error("GPS_REQUIRED"));m.end.mockRejectedValue(new Error("offline"));for(const result of[await startAttendanceAction(),await endAttendanceAction()]){expect(result.ok).toBe(false);expect(result.confirmedAt).toBeUndefined()}expect(m.revalidate).not.toHaveBeenCalled()});
