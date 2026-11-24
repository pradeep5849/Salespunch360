/**
 * Shared first-use verification policy for administrator-provisioned accounts.
 * The flag remains off until Web and Android API enforcement and OTP delivery
 * have been completed and tested.
 */
export type FirstUsePhonePrincipal = {
  role: string;
  phoneVerifiedAt: Date | null;
  phone: string | null;
  companyId: string | null;
};

export function requiresFirstUsePhoneVerification(
  user: FirstUsePhonePrincipal,
  enabled = process.env.FIRST_USE_PHONE_VERIFICATION_ENABLED === "true",
): boolean {
  if (!enabled) return false;
  // Platform operators are not company employees.
  if (user.role === "SUPER_ADMIN" || !user.companyId) return false;
  return user.phoneVerifiedAt === null;
}

/**
 * Only the phone verification, session termination and account recovery
 * endpoints may be accessed while first-use verification is required.
 * Apply this policy in both the Web request boundary and mobile API layer.
 */
export function isFirstUsePhoneGateExemptPath(pathname: string): boolean {
  return pathname === "/verify-mobile"
    || pathname.startsWith("/verify-mobile/")
    || pathname === "/api/auth/phone-otp/reserve"
    || pathname === "/api/auth/phone-otp/confirm"
    || pathname === "/api/auth/session-status"
    || pathname === "/api/v1/mobile/auth/verify-phone"
    || pathname.startsWith("/api/v1/mobile/auth/verify-phone/")
    || pathname === "/api/v1/mobile/auth/logout"
    || pathname === "/sign-out";
}
