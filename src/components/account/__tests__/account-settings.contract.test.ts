import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {ACCOUNT_SETTINGS_MENU} from "../account-settings-menu";
describe("Account settings navigation",()=>{
 it("uses the exact requested list and order",()=>expect(ACCOUNT_SETTINGS_MENU.map(x=>x.label)).toEqual(["General","Transaction","Invoice Print","Taxes & GST","User Management","Transaction SMS","Reminders","Party","Item","Multi-Currency"]));
 it("makes profile Settings functional on Web and Android",()=>{const web=readFileSync("src/components/account/account-profile-menu.tsx","utf8"),android=readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt","utf8");expect(web).toContain('href="/workspace/account/settings"');expect(web).not.toContain('account-menu-placeholder">Settings');expect(android).toContain('Text("Settings")');expect(android).not.toContain('Settings · Coming soon')});
 it("keeps the same menu labels on Android",()=>{const android=readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/account/admin/AccountAdministrationScreen.kt","utf8");for(const item of ACCOUNT_SETTINGS_MENU)expect(android).toContain(`"${item.label}"`)})
});
