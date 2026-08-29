# SalesPunch360 production operations

## Deployment

Prerequisites: Node.js 20.9+, PostgreSQL 14+ (managed/pooler recommended for horizontally scaled or serverless deployments), HTTPS reverse proxy, durable log destination, encrypted backup storage, and monitoring.

1. Provision a least-privilege PostgreSQL application identity and a separately controlled migration identity.
2. Configure `DATABASE_URL`, a unique 48+ character `AUTH_SECRET`, `NODE_ENV=production`, canonical HTTPS `APP_URL`, `TRUST_PROXY` only behind a trusted proxy, and `PAYMENT_PROVIDER=UNCONFIGURED` until a reviewed live adapter exists.
3. Back up the database and record a restore point.
4. Run `npm ci`, `npm run prisma:generate`, `npx prisma migrate deploy`, and `npx prisma migrate status`.
5. Run `npm run build`, deploy immutable artifacts, then `npm start` behind HTTPS.
6. Verify `/api/health` returns ready, then perform role/tenant smoke tests. Authenticated responses are private/no-store.

Production geolocation and Secure session cookies require HTTPS. Do not weaken cookies for HTTP. Next.js server actions provide action tokens; Stage 10 additionally rejects mismatched browser Origin values. Proxy-derived client addresses are trusted only with `TRUST_PROXY=true`. The PostgreSQL rate-limit table provides shared multi-instance limits; periodically delete expired buckets through controlled operations.

## Backups, restore, and recovery

Schedule provider-native or `pg_dump` backups with encrypted transport/storage, access controls, retention tiers, and off-site copies. Never place credentials in scripts or repositories. Restore into an isolated database regularly, run `prisma migrate status`, verify row counts/constraints, and perform tenant/auth smoke tests. Before rollout, define application rollback and forward-database recovery steps; historical migrations are immutable and database rollback may require restoring the pre-deploy backup rather than editing migration history.

## Production checklist

- [ ] Unique secrets and canonical HTTPS URL configured; test provider disabled
- [ ] Production database backed up and restore tested
- [ ] `migrate deploy` and `migrate status` successful
- [ ] HTTPS, Secure cookies, CSP/HSTS, health endpoint verified
- [ ] Trusted proxy decision documented
- [ ] Super Admin credentials protected; pricing/override audit checked
- [ ] Payment provider remains intentionally unavailable or live adapter separately reviewed
- [ ] Tenant isolation, role, IDOR, hostile-Origin and session-revocation tests pass
- [ ] Monitoring/log destination and alerts configured
- [ ] Mobile/desktop smoke tests and rollback plan approved

## Physical phone field-test checklist

Use disposable test-company data on a real HTTPS deployment: sign in; start attendance; grant/deny GPS; walk a route; verify point movement/route; search customer; test inside/outside/poor-accuracy geofence; check in; checkout with sentiment; create visit Lead; inspect all reports and target progress; simulate entitlement restriction while keeping attendance/visit open; verify safe checkout and attendance end; logout and confirm the session is revoked.

Browser simulation is not physical GPS validation. Android Chrome and desktop Chromium are primary tested targets. Other current standards-based browsers should work, but geolocation accuracy/background execution depends on device, OS, browser, power policy, and HTTPS. Browser GPS cannot guarantee tracking after suspension or termination. There is no native app, service worker, offline write synchronization, or live payment provider. The Stage 7 route diagram uses no public tiles; if external map tiles are added later, capacity, privacy, CSP and attribution must be reviewed. Infrastructure must supply monitoring, backup storage, restore automation, TLS termination, and alerting.
