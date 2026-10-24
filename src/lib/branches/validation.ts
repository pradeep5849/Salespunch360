import { z } from "zod";

const employeeId = z.string().guid();
const allBranchesAssignmentSchema = z.object({
  employeeId,
  branchAccessScope: z.literal("ALL_BRANCHES"),
}).strict();

const selectedBranchesAssignmentSchema = z.object({
  employeeId,
  branchAccessScope: z.literal("SELECTED_BRANCHES"),
  branchIds: z.array(z.string().guid()).min(1),
}).strict().superRefine(({ branchIds }, context) => {
  if (new Set(branchIds).size !== branchIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["branchIds"], message: "Branch IDs must be unique" });
  }
});

export const branchAssignmentSchema = z.union([
  allBranchesAssignmentSchema,
  selectedBranchesAssignmentSchema,
]);

export type BranchAssignmentInput = z.input<typeof branchAssignmentSchema>;
export type ValidBranchAssignment = z.output<typeof branchAssignmentSchema>;
