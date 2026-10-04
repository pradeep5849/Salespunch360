export const contentSecurityPolicy = (production: boolean, nonce?: string) =>
  [
    "default-src 'self'",
    `script-src 'self' ${nonce ? `'nonce-${nonce}' 'strict-dynamic'` : "'unsafe-inline'"} ${production ? "" : "'unsafe-eval' "}blob: https://maps.googleapis.com https://maps.gstatic.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com https://*.tile.openstreetmap.org",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.google.com",
    "worker-src 'self' blob:",
    "frame-src https://*.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(production ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
