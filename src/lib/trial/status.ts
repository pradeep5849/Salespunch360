import type { Company, SubscriptionStatus } from "@prisma/client";
import { trialEntitlementsFor, TRIAL_DURATION_MS } from "./config";

type CompanyLifecycle = Pick<Company, "trialStartedAt" | "trialEndsAt" | "subscriptionStatus" | "teamStructure">;

export type TrialStatus = {
  isInTrial: boolean;
  isTrialExpired: boolean;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  remainingDays: number;
  subscriptionStatus: SubscriptionStatus;
  effectiveStatus: SubscriptionStatus;
  managerAllowance: number;
  salesAllowance: number;
};

export function calculateTrialEndsAt(startedAt: Date) {
  return new Date(startedAt.getTime() + TRIAL_DURATION_MS);
}

export function getTrialStatus(company: CompanyLifecycle, now = new Date()): TrialStatus {
  const entitlements = trialEntitlementsFor(company.teamStructure);
  const hasTrialDates = company.trialStartedAt !== null && company.trialEndsAt !== null;
  const timeExpired = !company.trialEndsAt || now.getTime() >= company.trialEndsAt.getTime();
  const isTrialLifecycle = company.subscriptionStatus === "TRIAL";
  const isInTrial = isTrialLifecycle && hasTrialDates && !timeExpired;
  const isTrialExpired = isTrialLifecycle && hasTrialDates && timeExpired;
  const remainingMs = isInTrial ? company.trialEndsAt!.getTime() - now.getTime() : 0;

  return {
    isInTrial,
    isTrialExpired,
    trialStartedAt: company.trialStartedAt,
    trialEndsAt: company.trialEndsAt,
    remainingDays: Math.ceil(remainingMs / (24 * 60 * 60 * 1_000)),
    subscriptionStatus: company.subscriptionStatus,
    effectiveStatus: isTrialExpired ? "EXPIRED" : company.subscriptionStatus,
    managerAllowance: entitlements.manager,
    salesAllowance: entitlements.sales,
  };
}
