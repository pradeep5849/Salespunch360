export const HEALTH_URL: string;
export function checkProductionHealth(
  fetchHealth?: typeof fetch,
): Promise<boolean>;
export function runHealthMonitor(
  check?: () => Promise<unknown>,
  pause?: (ms: number) => Promise<unknown>,
): Promise<boolean>;
