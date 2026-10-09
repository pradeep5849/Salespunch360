/** Only an official Google Play app listing is a download destination. */
export function validatedGooglePlayUrl(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    const ids = url.searchParams.getAll("id");
    return url.protocol === "https:" &&
      url.hostname === "play.google.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === "/store/apps/details" &&
      ids.length === 1 &&
      /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(ids[0])
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
/** Admin configuration takes precedence; invalid legacy values fall back to validated deployment configuration. */
export function googlePlayDestination(
  configured: string | null | undefined,
  deployed: string | undefined,
) {
  return validatedGooglePlayUrl(configured) ?? validatedGooglePlayUrl(deployed);
}
