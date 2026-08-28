const WINDOW_MS = 15 * 60 * 1_000;
const MAX_ATTEMPTS = 5;

type Window = { count: number; resetsAt: number };
const attempts = new Map<string, Window>();

/** Best-effort per-instance guard; production deployments can replace this with shared storage. */
export function allowRegistrationAttempt(key: string, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || current.resetsAt <= now) {
    attempts.set(key, { count: 1, resetsAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}
