import{describe,expect,it}from"vitest";import{PROFILE_MENU_ITEMS}from"./profile-menu";
describe("workspace profile menu contract",()=>{it("keeps switching first and billing in the right profile menu",()=>{expect(PROFILE_MENU_ITEMS).toEqual(["Switch to Accounts","Company Details","Follow-up Tasks","Billing & Subscription","Change Password","Logout"]);expect(PROFILE_MENU_ITEMS).toHaveLength(6)})});
