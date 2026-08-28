export const TRIAL_DURATION_DAYS = 15;

/** One server-owned source of truth, ready to be replaced by platform configuration later. */
export const DEFAULT_TRIAL_ENTITLEMENTS = Object.freeze({
  companyAdmin: 1,
  manager: 1,
  sales: 5,
});

export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1_000;
