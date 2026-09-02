import {describe,expect,it} from "vitest";
import {formatIndiaDateTime,INDIA_TIME_ZONE} from "./india";

describe("India date-time display",()=>{
 it("uses the explicit India timezone",()=>expect(INDIA_TIME_ZONE).toBe("Asia/Kolkata"));
 it("crosses the India calendar boundary deterministically",()=>expect(formatIndiaDateTime(new Date("2026-09-01T20:00:00.000Z"))).toBe("2 Sept 2026, 1:30 am"));
});
