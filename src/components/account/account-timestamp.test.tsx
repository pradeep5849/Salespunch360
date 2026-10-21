import {afterEach,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {AccountUtcTimestamp} from "./account-ui";
import {DisplayPreferencesProvider} from "./display-preferences";
import {DEFAULT_DISPLAY_PREFERENCES} from "@/lib/account/display-preferences";
const zone=process.env.TZ;
afterEach(()=>{if(zone===undefined)delete process.env.TZ;else process.env.TZ=zone});
it("formats metadata calendar preferences without shifting the ISO UTC clock at a zone boundary",()=>{
 process.env.TZ="Pacific/Honolulu";
 const html=renderToStaticMarkup(<DisplayPreferencesProvider values={{...DEFAULT_DISPLAY_PREFERENCES,dateFormat:"MM/DD/YYYY"}}><AccountUtcTimestamp value={new Date("2026-10-13T00:30:15.123Z")}/></DisplayPreferencesProvider>);
 expect(html).toContain("10/13/2026");expect(html).toContain("00:30:15.123Z");expect(html).toContain('dateTime="2026-10-13T00:30:15.123Z"');expect(html).not.toContain("10/12/2026");
});
it("preserves original ISO calendar style when selected",()=>{
 const html=renderToStaticMarkup(<DisplayPreferencesProvider values={{...DEFAULT_DISPLAY_PREFERENCES,dateFormat:"YYYY-MM-DD"}}><AccountUtcTimestamp value={new Date("2026-10-13T23:59:59.999Z")}/></DisplayPreferencesProvider>);expect(html).toContain("2026-10-13");expect(html).toContain("23:59:59.999Z");
});
