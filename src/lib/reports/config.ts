export const REPORT_TIME_ZONE = "Asia/Kolkata";
export const REPORT_DEFAULT_DAYS = 7;
export const REPORT_MAX_DAYS = 366;
export const REPORT_DEFAULT_PAGE_SIZE = 25;
export const REPORT_MAX_PAGE_SIZE = 100;

/** Stage 7 uses one application timezone; this seam permits a future company setting. */
export function reportingTimeZone() { return REPORT_TIME_ZONE; }
