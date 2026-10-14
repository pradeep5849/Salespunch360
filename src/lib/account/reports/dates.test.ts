import {expect,it} from "vitest";
import {reportCalendarDate,reportFinancialYearStart} from "./dates";
it.each([
 ["2026-03-31T18:29:59Z","2026-03-31","2025-04-01"],
 ["2026-03-31T18:30:00Z","2026-04-01","2026-04-01"],
 ["2026-12-31T18:30:00Z","2027-01-01","2026-04-01"],
 ["2026-01-10T00:00:00Z","2026-01-10","2025-04-01"],
])("uses the business calendar at %s",(instant,day,start)=>{
 expect(reportCalendarDate(new Date(instant))).toBe(day);
 expect(reportFinancialYearStart(new Date(instant)).toISOString().slice(0,10)).toBe(start);
});
