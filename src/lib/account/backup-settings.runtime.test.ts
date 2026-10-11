import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({configs:vi.fn(),config:vi.fn(),latest:vi.fn(),admin:vi.fn(),lock:vi.fn(),backup:vi.fn(),storage:vi.fn(),save:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{accountSettings:{findMany:m.configs,findUnique:m.config},accountBackupRecord:{findFirst:m.latest},user:{findFirst:m.admin},$transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn({$executeRaw:m.lock,accountSettings:{findUnique:m.config},accountBackupRecord:{findFirst:m.latest}})}}));
vi.mock("@/lib/storage",()=>({privateStorage:m.storage}));
vi.mock("./settings-persistence",()=>({updateSettingsSectionForActor:m.save}));
vi.mock("./utilities",()=>({createAccountBackupForActor:m.backup}));
import {saveBackupSettings,generateScheduledAccountBackups,backupReminderDue} from "./backup-settings";
const actor={id:"admin",companyId:"company",accountRole:"ACCOUNT_ADMIN"};
const prefs={autoBackup:true,intervalDays:7,manualReminderDays:7};
beforeEach(()=>{vi.clearAllMocks();m.configs.mockResolvedValue([{companyId:"company",transactionDefaults:{backupSettings:prefs}}]);m.config.mockResolvedValue({transactionDefaults:{backupSettings:prefs}});m.admin.mockResolvedValue({id:"admin",accountRole:"ACCOUNT_ADMIN"});m.latest.mockResolvedValue(null);m.storage.mockReturnValue({})});
describe("A088 backup execution",()=>{
 it("validates intervals before saving",async()=>{await expect(saveBackupSettings(actor,{...prefs,intervalDays:0})).rejects.toThrow();expect(m.save).not.toHaveBeenCalled()});
 it("refuses to enable automatic backup if private storage is unavailable",async()=>{m.storage.mockImplementation(()=>{throw new Error("PHOTO_STORAGE_NOT_CONFIGURED")});await expect(saveBackupSettings(actor,prefs)).rejects.toThrow();expect(m.save).not.toHaveBeenCalled()});
 it("archives a due bundle as an active company administrator",async()=>{expect(await generateScheduledAccountBackups(new Date("2026-10-11"))).toMatchObject({generated:1});expect(m.backup).toHaveBeenCalledWith(actor,true);expect(m.lock).toHaveBeenCalled()});
 it("rechecks a newly disabled automatic-backup setting before creating an archive",async()=>{m.config.mockResolvedValue({transactionDefaults:{backupSettings:{...prefs,autoBackup:false}}});expect(await generateScheduledAccountBackups()).toMatchObject({generated:0});expect(m.backup).not.toHaveBeenCalled()});
 it("does not regenerate a recent archive on repeat maintenance runs",async()=>{m.latest.mockResolvedValue({generatedAt:new Date("2026-10-10")});expect(await generateScheduledAccountBackups(new Date("2026-10-11"))).toMatchObject({generated:0});expect(m.backup).not.toHaveBeenCalled()});
 it("does not archive under a missing or inactive administrator",async()=>{m.admin.mockResolvedValue(null);await generateScheduledAccountBackups();expect(m.backup).not.toHaveBeenCalled()});
 it("uses the most recent manual backup to calculate reminder due",async()=>{m.config.mockResolvedValue({transactionDefaults:{backupSettings:{...prefs,autoBackup:false}},createdAt:new Date("2026-01-01")});m.latest.mockResolvedValue({generatedAt:new Date("2026-10-01")});expect(await backupReminderDue("company",new Date("2026-10-09"))).toBe(true);expect(await backupReminderDue("company",new Date("2026-10-03"))).toBe(false)});
});
