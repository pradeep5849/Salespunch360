/** Historical COMPLETED records are report-only, like CLOSED and CANCELLED. */
export const FINAL_PROJECT_STATUSES = [
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
] as const;
export const isFinalProjectStatus = (status: string) =>
  FINAL_PROJECT_STATUSES.some((x) => x === status);
