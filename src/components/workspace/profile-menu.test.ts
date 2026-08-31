import{describe,expect,it}from"vitest";import{PROFILE_MENU_ITEMS}from"./profile-menu";
describe("workspace profile menu contract",()=>{it.each(["COMPANY_ADMIN","MANAGER","SALES"])("has exactly three locked items for %s",()=>{expect(PROFILE_MENU_ITEMS).toEqual(["Company Details","Change Password","Logout"]);expect(PROFILE_MENU_ITEMS).toHaveLength(3)})});
