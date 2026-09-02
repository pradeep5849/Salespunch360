import{describe,expect,it}from"vitest";import{PROFILE_MENU_ITEMS}from"./profile-menu";
describe("workspace profile menu contract",()=>{it("defines the role-aware follow-up item",()=>{expect(PROFILE_MENU_ITEMS).toEqual(["Company Details","Follow-up Tasks","Change Password","Logout"]);expect(PROFILE_MENU_ITEMS).toHaveLength(4)})});
