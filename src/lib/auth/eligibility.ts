export function canAuthenticate(user: { isActive: boolean } | null | undefined) {
  return Boolean(user?.isActive);
}
