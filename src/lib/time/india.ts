export const INDIA_TIME_ZONE = "Asia/Kolkata";

export function formatIndiaDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
