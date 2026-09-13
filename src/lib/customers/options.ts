export type BranchAwareAssignee={id:string;branchAccessScope:string;branchAccesses:{branchId:string}[]};
export function assigneesForBranch<T extends BranchAwareAssignee>(assignees:T[],branchId:string){return branchId?assignees.filter(user=>user.branchAccessScope==="ALL_BRANCHES"||user.branchAccesses.some(access=>access.branchId===branchId)):[]}
