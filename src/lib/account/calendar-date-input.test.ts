import {expect,it} from "vitest";
import {calendarDateInput} from "./calendar-date-input";
it("validates real business dates without date rollover",()=>{
 expect(calendarDateInput.parse("2024-02-29").toISOString()).toBe("2024-02-29T00:00:00.000Z");
 for(const value of ["2026-02-29","2026-02-30","2026-13-01","26/10/2026","2026-11-05T23:00:00Z"])expect(calendarDateInput.safeParse(value).success).toBe(false);
 expect(calendarDateInput.parse(new Date("2026-11-05"))).toEqual(new Date("2026-11-05"));
});
