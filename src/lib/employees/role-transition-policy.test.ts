import{describe,expect,it}from"vitest";import{salesRoleAssignment,salesRoleTransitionUpdate,seatActionState}from"./role-transition-policy";
describe("Sales role transitions",()=>{it.each([
 ["SALES_EMPLOYEE","SALES_MANAGER","MANAGER","FIELD_MANAGER"],
 ["SALES_MANAGER","SALES_EMPLOYEE","SALES",null],
 ["ADDITIONAL_ADMIN","SALES_MANAGER","MANAGER","FIELD_MANAGER"],
 ["SALES_MANAGER","ADDITIONAL_ADMIN","ADMIN",null],
 ["SALES_EMPLOYEE","ADDITIONAL_ADMIN","ADMIN",null],
 ["ADDITIONAL_ADMIN","SALES_EMPLOYEE","SALES",null],
]as const)("maps %s to %s",(_from,to,salesRole,managerType)=>expect(salesRoleAssignment(to)).toMatchObject({salesRole,managerType}));it("clears incompatible manager relations",()=>{expect(salesRoleAssignment("ADDITIONAL_ADMIN","manager").managerId).toBeNull();expect(salesRoleAssignment("SALES_MANAGER","manager").managerId).toBeNull()});it("retains a valid manager only for Sales",()=>expect(salesRoleAssignment("SALES_EMPLOYEE","manager").managerId).toBe("manager"));it("preserves the Account dimension when changing Sales role",()=>{const update=salesRoleTransitionUpdate({accountRole:"ACCOUNTANT"},salesRoleAssignment("SALES_MANAGER"));expect(update).not.toHaveProperty("accountRole");expect(update.role).toBe("MANAGER")})});
describe("full capacity editability",()=>{it.each(["Additional Admin","Manager","Sales","Account Admin","Accountant","Project Manager","Data Entry"])("keeps %s editable while blocking Add",()=>expect(seatActionState(true,1,1)).toEqual({canManage:true,canAdd:false,remaining:0}));it("inactive capacity creates room",()=>expect(seatActionState(true,0,1).canAdd).toBe(true))});
