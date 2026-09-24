type CallbackWithDate = { nextCallbackAt: Date | null };

function indiaEndOfDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const year = Number(value.year);
  const month = Number(value.month);
  const day = Number(value.day);
  // India is UTC+05:30 year-round, so 23:59:59.999 IST is 18:29:59.999 UTC.
  return Date.UTC(year, month - 1, day, 18, 29, 59, 999);
}

export function partitionCallbackQueue<T extends CallbackWithDate>(callbacks: T[], now = new Date()) {
  const nowMs = now.getTime();
  const endTodayMs = indiaEndOfDay(now);
  return {
    overdue: callbacks.filter(item => item.nextCallbackAt && item.nextCallbackAt.getTime() < nowMs),
    today: callbacks.filter(item => item.nextCallbackAt && item.nextCallbackAt.getTime() >= nowMs && item.nextCallbackAt.getTime() <= endTodayMs),
    upcoming: callbacks.filter(item => item.nextCallbackAt && item.nextCallbackAt.getTime() > endTodayMs),
  };
}
