import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it} from "vitest";
import {BackupPreferencesFields} from "./backup-preferences-fields";
const render=(connected:boolean,auto:boolean)=>renderToStaticMarkup(createElement(BackupPreferencesFields,{connected,auto,interval:2,reminder:10}));
it("shows the interval when Google Drive is connected and automatic backup is enabled",()=>{const html=render(true,true);expect(html).toContain('id="intervalDays"');expect(html).toContain('id="manualReminderDays"');expect(html).toContain('checked=""');expect(html).not.toContain('disabled="" checked')});
it("keeps the manual reminder and hides the automatic interval when disabled",()=>{const html=render(true,false);expect(html).toContain('type="hidden" name="intervalDays" value="2"');expect(html).toContain('id="manualReminderDays"');expect(html).not.toContain('id="intervalDays"')});
it("does not activate a legacy saved automatic setting before Google Drive is connected",()=>{const html=render(false,true);expect(html).toContain('disabled=""');expect(html).not.toContain('checked=""');expect(html).not.toContain('id="intervalDays"');expect(html).toContain('only your personal Google Drive')});
