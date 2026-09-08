import type { SalesRole } from "@prisma/client";

type EmployeeIdentity = { salesRole: SalesRole | null };

export const isManagerEmployee = (employee: EmployeeIdentity) => employee.salesRole === "MANAGER";
export const isSalesEmployee = (employee: EmployeeIdentity) => employee.salesRole === "SALES";
export const canManageEmployeeTravel = (salesRole: SalesRole | null) => salesRole === "PRIMARY_ADMIN";
