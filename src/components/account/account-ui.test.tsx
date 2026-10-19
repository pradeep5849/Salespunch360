import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {humanize,StatusBadge,AccountTimestamp} from "./account-ui";

describe("authenticated account presentation",()=>{
  it("turns internal enum values into readable labels",()=>{expect(humanize("PENDING_APPROVAL")).toBe("Pending Approval");expect(humanize("PURCHASE_BILL")).toBe("Purchase Bill")});
  it("uses restrained semantic status tones",()=>{expect(renderToStaticMarkup(<StatusBadge value="POSTED"/>)).toContain("account-status-success");expect(renderToStaticMarkup(<StatusBadge value="REJECTED"/>)).toContain("account-status-danger")});
});

import {DisplayPreferencesProvider} from "./display-preferences";
import {resolveDisplayPreferences} from "@/lib/account/display-preferences";
describe("A090 server-local audit timestamps",()=>{
 it.each([["DD/MM/YYYY","19/10/2026"],["MM/DD/YYYY","10/19/2026"],["YYYY-MM-DD","2026-10-19"]] as const)("uses %s without changing the existing wall-clock time",(format,expected)=>{
  const value=new Date(2026,9,19,13,5,9);
  const html=renderToStaticMarkup(<DisplayPreferencesProvider values={resolveDisplayPreferences({dateFormat:format})}><AccountTimestamp value={value}/></DisplayPreferencesProvider>);
  expect(html).toContain(expected);expect(html).toContain(value.toLocaleTimeString());expect(html).toContain(`dateTime="${value.toISOString()}"`);expect(value.getHours()).toBe(13);
 });
 it("keeps midnight in the same server-local calendar as the retained clock",()=>{
  const value=new Date(2026,0,1,0,5,0);
  const html=renderToStaticMarkup(<DisplayPreferencesProvider values={resolveDisplayPreferences({dateFormat:"YYYY-MM-DD"})}><AccountTimestamp value={value}/></DisplayPreferencesProvider>);
  expect(html).toContain("2026-01-01");expect(html).toContain(value.toLocaleTimeString());
 });
});
