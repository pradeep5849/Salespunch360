type Context = {
  correlationId?: string;
  category: string;
  userId?: string;
  companyId?: string;
  code?: string;
  durationMs?: number;
};
// Runtime allowlist: TypeScript cannot prevent extra properties on callers' objects.
export function logEvent(level: "info" | "warn" | "error", context: Context) {
  const safe = {
    timestamp: new Date().toISOString(),
    level,
    category: context.category,
    correlationId: context.correlationId,
    userId: context.userId,
    companyId: context.companyId,
    code: context.code,
    durationMs: context.durationMs,
  };
  const output = JSON.stringify(safe);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}
