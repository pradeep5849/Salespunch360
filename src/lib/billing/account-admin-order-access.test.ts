import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({user:vi.fn(),company:vi.fn(),transaction:vi.fn(),prices:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{},requireUser:m.user,requireUserForMutation:m.user,requireGlobalSuperAdmin:vi.fn(),requireGlobalSuperAdminForMutation:vi.fn()}));
vi.mock("@/lib/auth/permissions",()=>({canUsePermission:()=>false}));
vi.mock("@/lib/db",()=>({db:{company:{findUnique:m.company},$transaction:m.transaction,billingPrice:{findMany:m.prices}}}));
import {createAccountPackageOrder,createBillingOrder} from "./service";
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue({id:"account-admin",companyId:"company",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true,salesAccessActive:false,salesRole:null});m.company.mockResolvedValue({id:"company",productEdition:"SALESPUNCH360_ACCOUNT"})});
it("denies Account-only admin package creation before prices or order writes",async()=>{await expect(createAccountPackageOrder(1,"YEARLY")).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled();expect(m.prices).not.toHaveBeenCalled()});
it("also denies crafted Sales subscription requests from Account-only admins",async()=>{await expect(createBillingOrder({})).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled();expect(m.prices).not.toHaveBeenCalled()});
