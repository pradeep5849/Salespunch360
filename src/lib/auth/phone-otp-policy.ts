/**
 * Registration SMS budget. Enforce this atomically in a shared persistent store
 * BEFORE calling Firebase to send an SMS; never rely on browser state or IP alone.
 *
 * Count both initial sends and resends. Use a rolling 24-hour window keyed by
 * normalized E.164 phone number. Do not count code-entry attempts as SMS sends.
 */
export const REGISTRATION_OTP_MAX_SENDS = 2;
export const REGISTRATION_OTP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const REGISTRATION_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export type PhoneOtpSendRecord = { sentAt: Date };

export function checkRegistrationOtpSendBudget(
  sends: readonly PhoneOtpSendRecord[],
  now = new Date(),
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  const current = now.getTime();
  const recent = sends.map((record) => record.sentAt.getTime())
    .filter((time) => Number.isFinite(time) && time <= current && time > current - REGISTRATION_OTP_WINDOW_MS)
    .sort((a, b) => a - b);
  if (recent.length >= REGISTRATION_OTP_MAX_SENDS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((recent[recent.length - REGISTRATION_OTP_MAX_SENDS] + REGISTRATION_OTP_WINDOW_MS - current) / 1000),
      remaining: 0,
    };
  }
  const latest = recent[recent.length - 1];
  if (latest !== undefined && current - latest < REGISTRATION_OTP_RESEND_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((latest + REGISTRATION_OTP_RESEND_COOLDOWN_MS - current) / 1000),
      remaining: REGISTRATION_OTP_MAX_SENDS - recent.length,
    };
  }
  return { allowed: true, retryAfterSeconds: 0, remaining: REGISTRATION_OTP_MAX_SENDS - recent.length };
}
