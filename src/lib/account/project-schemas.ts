import {
  ProjectStatus,
  ProjectMilestoneStatus,
  ProjectTaskStatus,
} from "@prisma/client";
import { z } from "zod";
const money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);
const optionalText = (length: number) =>
  z.string().trim().max(length).optional();
const optionalUuid = z.string().uuid().optional();
const operationalStatuses = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;

export const projectInput = z
  .object({
    branchId: z.string().uuid(),
    name: z.string().trim().min(1).max(240),
    customerId: z.string().uuid(),
    siteName: optionalText(240),
    siteAddress: optionalText(4000),
    siteContactName: optionalText(160),
    siteContactPhone: optionalText(30),
    projectManagerId: optionalUuid,
    startDate: z.coerce.date().optional(),
    targetEndDate: z.coerce.date().optional(),
    projectValue: money.default("0"),
  })
  .strict();
export const projectUpdateInput = projectInput
  .omit({ branchId: true, customerId: true })
  .extend({ projectId: z.string().uuid(), status: z.enum(operationalStatuses) })
  .strict();
export const projectStatusInput = z
  .object({ projectId: z.string().uuid(), status: z.nativeEnum(ProjectStatus) })
  .strict();
export const budgetInput = z
  .object({
    projectId: z.string().uuid(),
    lines: z
      .array(
        z
          .object({
            category: z.string().trim().min(1).max(120),
            title: z.string().trim().min(1).max(240),
            description: optionalText(2000),
            amount: money,
          })
          .strict(),
      )
      .max(250),
  })
  .strict();
const milestoneFields = z
  .object({
    title: z.string().trim().min(1).max(240),
    description: optionalText(2000),
    startDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    status: z.nativeEnum(ProjectMilestoneStatus).default("PENDING"),
  })
  .strict();
export const milestoneInput = milestoneFields
  .extend({ projectId: z.string().uuid() })
  .strict();
export const milestoneUpdateInput = milestoneFields
  .extend({ projectId: z.string().uuid(), milestoneId: z.string().uuid() })
  .strict();
const taskFields = z
  .object({
    milestoneId: optionalUuid,
    title: z.string().trim().min(1).max(240),
    description: optionalText(2000),
    assigneeUserId: optionalUuid,
    dueDate: z.coerce.date().optional(),
    priority: z.coerce.number().int().min(0).max(3).default(0),
    status: z.nativeEnum(ProjectTaskStatus).default("TODO"),
  })
  .strict();
export const taskInput = taskFields
  .extend({ projectId: z.string().uuid() })
  .strict();
export const taskUpdateInput = taskFields
  .extend({ projectId: z.string().uuid(), taskId: z.string().uuid() })
  .strict();
