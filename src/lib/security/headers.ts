export const contentSecurityPolicy = (production: boolean, nonce?: string, cashfree = false) =>
  [
    "default-src 'self'",
    `script-src 'self' ${nonce ? `'nonce-${nonce}' 'strict-dynamic'` : "'unsafe-inline'"} ${production ? "" : "'unsafe-eval' "}blob: https://maps.googleapis.com https://maps.gstatic.com${cashfree ? " https://sdk.cashfree.com" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.tile.openstreetmap.org${cashfree ? " https://sandbox.cashfree.com https://sdk.cashfree.com" : ""}`,
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com${cashfree ? " https://sandbox.cashfree.com https://sdk.cashfree.com" : ""}`,
    "worker-src 'self' blob:",
    `frame-src https://*.google.com${cashfree ? " https://sandbox.cashfree.com https://sdk.cashfree.com" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `form-action 'self'${cashfree ? " https://sandbox.cashfree.com https://sdk.cashfree.com" : ""}`,
    "object-src 'none'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
