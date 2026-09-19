import{describe,expect,it}from"vitest";import{accountGroups,activeUsage,salesDirectoryUsers,salesGroups,salesRoleLabel,type DirectoryUser}from"./directory-policy";import{accountPackageLimits}from"@/lib/billing/account-package";
const user=(id:string,patch:Partial<DirectoryUser>={}):DirectoryUser=>({id,name:id,email:`${id}@x.test`,isActive:true,salesAccessActive:true,accountAccessActive:true,salesRole:"SALES",accountRole:null,managerType:null,...patch});
const owner=user("owner",{salesRole:"PRIMARY_ADMIN",accountRole:"ACCOUNT_ADMIN"}),admin=user("admin",{salesRole:"ADMIN"}),field=user("field",{salesRole:"MANAGER",managerType:"FIELD_MANAGER"}),office=user("office",{salesRole:"MANAGER",managerType:"MANAGER_ONLY"}),sales=user("sales"),inactive=user("inactive",{isActive:false}),all=[owner,admin,field,office,sales,inactive];
describe("Sales employee directory",()=>{
 it.each(["all","administrators","active","inactive"])("excludes Primary Admin from %s",view=>{const groups=salesGroups(all),rows=view==="administrators"?groups.admins:view==="active"?groups.active:view==="inactive"?groups.inactive:salesDirectoryUsers(all);expect(rows.map(x=>x.id)).not.toContain("owner")});
 it("counts only Additional Admin seats",()=>expect(activeUsage(all,"sales","ADMIN")).toBe(1));
 it("supports trial Additional Admin 0 / 0",()=>expect({active:activeUsage([owner],"sales","ADMIN"),allowed:0}).toEqual({active:0,allowed:0}));
 it("maps Field Manager to FIELD_MANAGER",()=>expect(salesRoleLabel(field)).toBe("Field Manager"));
 it("maps Office Manager to MANAGER_ONLY",()=>expect(salesRoleLabel(office)).toBe("Office Manager"));
 it("introduces no third manager group",()=>expect([...salesGroups(all).salesManagers,...salesGroups(all).officeManagers]).toHaveLength(2));
 it("returns one combined inactive list",()=>expect(salesGroups([...all,user("suspended",{salesAccessActive:false})]).inactive.map(x=>x.id)).toEqual(["inactive","suspended"]));
 it("does not count inactive users against seats",()=>expect(activeUsage(all,"sales","SALES")).toBe(1));
 it("deduplicates cards by user id",()=>expect(salesDirectoryUsers([...all,sales]).filter(x=>x.id==="sales")).toHaveLength(1));
 it("separates all four Sales groups",()=>{const g=salesGroups(all);expect([g.admins.length,g.salesManagers.length,g.officeManagers.length,g.sales.length]).toEqual([1,1,1,2])});
});
describe("Account employee directory and package",()=>{
 const accountant=user("accountant",{salesRole:null,accountRole:"ACCOUNTANT"}),project=user("project",{salesRole:null,accountRole:"PROJECT_MANAGER"}),entry=user("entry",{salesRole:null,accountRole:"DATA_ENTRY"}),extraAdmin=user("aa",{salesRole:null,accountRole:"ACCOUNT_ADMIN"});
 it("one package provides one fixed seat per role",()=>expect(accountPackageLimits(1)).toEqual({ACCOUNT_ADMIN:1,ACCOUNTANT:1,PROJECT_MANAGER:1,DATA_ENTRY:1}));
 it("owner occupies first Account Admin capacity",()=>expect(activeUsage([owner],"account","ACCOUNT_ADMIN")).toBe(1));
 it("one package blocks an extra Account Admin",()=>expect(activeUsage([owner],"account","ACCOUNT_ADMIN")>=accountPackageLimits(1).ACCOUNT_ADMIN).toBe(true));
 it.each([["ACCOUNTANT",accountant],["PROJECT_MANAGER",project],["DATA_ENTRY",entry]] as const)("leaves %s available at 0 / 1",(role,row)=>{void row;expect(activeUsage([owner],"account",role)).toBe(0)});
 it("two packages allow one Account Admin beyond owner",()=>expect(activeUsage([owner],"account","ACCOUNT_ADMIN")<accountPackageLimits(2).ACCOUNT_ADMIN).toBe(true));
 it("inactive Account users consume no seat",()=>expect(activeUsage([{...accountant,isActive:false}],"account","ACCOUNTANT")).toBe(0));
 it("combines every inactive Account role",()=>{const rows=[extraAdmin,accountant,project,entry].map(x=>({...x,accountAccessActive:false}));expect(accountGroups(rows).inactive).toHaveLength(4)});
 it("Sales Additional Admin receives no Account role automatically",()=>expect(admin.accountRole).toBeNull());
 it("preserves a shared one-Sales plus one-Account identity",()=>{const shared=user("shared",{salesRole:"SALES",accountRole:"ACCOUNTANT"});expect(salesGroups([shared]).sales).toHaveLength(1);expect(accountGroups([shared]).ACCOUNTANT).toHaveLength(1)});
 it("deduplicates Account cards",()=>expect(accountGroups([accountant,accountant]).ACCOUNTANT).toHaveLength(1));
});
