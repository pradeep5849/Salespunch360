export const TRIAL_DURATION_DAYS = 15;

/** One server-owned source of truth, ready to be replaced by platform configuration later. */
export const DEFAULT_TRIAL_ENTITLEMENTS = Object.freeze({
  companyAdmin: 1,
  manager: 1,
  sales: 5,
});

export function trialEntitlementsFor(teamStructure: "MANAGERS_AND_SALES" | "SALES_ONLY") {
  return Object.freeze({
    companyAdmin: DEFAULT_TRIAL_ENTITLEMENTS.companyAdmin,
    manager: teamStructure === "SALES_ONLY" ? 0 : DEFAULT_TRIAL_ENTITLEMENTS.manager,
    sales: DEFAULT_TRIAL_ENTITLEMENTS.sales,
  });
}

export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1_000;
