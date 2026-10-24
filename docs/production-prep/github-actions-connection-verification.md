# GitHub Actions existing-secret connection verification — 24 October 2026

## Outcome

**BLOCKED: both existing PostgreSQL connection secrets are rejected with Prisma P1000.** No production-changing migrations, secret creation/update, password reset or deployment occurred. Main is unchanged; workflow implementation is on `ops/supabase-readonly-connection-test`.

Repository/organization secret-name listing and variable listing return403Resource not accessible by integration. The existing main workflow references DATABASE_URL and DIRECT_URL. Dispatched runtime checks independently establish both bindings are present, so lack of secret-list permission is not treated as proof that the secrets are missing. GitHub does not expose encrypted secret values for retrieval; no attempt was made to print or export them.

## Confirmed configuration

Both DIRECT_URL and DATABASE_URL parse as Supabase Session pooler endpoints on5432, route to Salespunch360's project reference and match ap-south-1. Only booleans, secret names and endpoint classification are logged; no hostname/user/password/URL value is emitted. Secrets are exposed only to the connection step, not checkout, setup-node, dependency installation or client generation.

The workflow has an explicit `connection-test` operation, defaulting to read-only. It can select either existing secret independently. Connection code requires a validated destination and uses a read-only repeatable-read transaction with statement/lock timeouts. There is no DDL or data-changing SQL in this check. The deployment job requires both main and operation=migrate; every verification run skipped that job. Do not dispatch the unchanged workflow on main: its old definition still deploys migrations without the new input gate.

## Runs and actual results

1. Run40114040607, head1f6f4b285ea5c3149eba82e7eefeef79a5f11009: initial connection rejected before queries; both secrets present with correct Session pooler/project format.
2. Run40114198507, heada25661769117a812f77f2abfca930dccb585fbe6: credential-safe classification identified P1011/TLS failure with strict verification. No authentication/query success claimed.
3. Run40114453835, headc5942073d2689903ade22c2e5a368890381ab7be: official Supabase public CA fixed TLS; DIRECT_URL then rejected with P1000 authentication failure. No production queries ran through Actions.
4. Run40114666112, headbfb1816d25871f9e3d15e706c6ce9515544de5da: separately selected DATABASE_URL, confirmed correct pooler region, TLS verification passed, then P1000 authentication failure. Deployment job skipped.

Latest run: https://github.com/pradeep5849/Salespunch360/actions/runs/40114666112

Official CA comes from the URL used by Supabase Studio's SSL configuration/custom content: `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`. The workflow downloads it over verified HTTPS, checks expiry and supplies it through Prisma's sslcert option while requiring sslmode=require and sslaccept=strict. It does not disable certificate checks or change the saved secrets/database SSL enforcement. The public certificate is not a credential and needs no new secret.

## Database state verified separately

After the Actions attempts, the connected Supabase integration performed another read-only aggregate check:89successful migrations,0unresolved attempts,7application users,1SUPER_ADMIN and1active global SUPER_ADMIN with a nonempty password hash. The previous full live comparison establishes the exact59pending names/checksums; no migrations ran in this phase. These database results come from Supabase SQL, **not** from the failed Actions connections. Original Super Admin password/browser login remains untested. P1000 refers to the PostgreSQL connection identity, not the public application account.

## Validation and remaining configuration

Seven focused Node safety tests passed,0failed/skipped. ESLint, formatting and workflow guard inspection passed. The guard inspection confirms no deployment/provisioning command in the connection-test job and production secrets scoped to one step. No dependency version or lockfile changed.

The existing secrets have a suitable endpoint format but cannot yet be certified reusable for migration execution because database authentication fails. Possible causes include an outdated/incorrect credential, unsuitable database-role identity, pooler-side authentication configuration or incorrect URL-encoding of password characters. Do not assert a specific cause from P1000 alone.

Owner action: privately compare the existing GitHub Actions DIRECT_URL and DATABASE_URL with the known-working PostgreSQL connection in the application's private configuration/password manager and the Salespunch360 Connect→Session pooler details. Correct the existing entries if necessary, without adding duplicates or resetting database/application passwords. Preserve URL encoding and the full pooler username. Do not paste credentials into chat. After correction, dispatch the feature branch's read-only connection-test for the corrected secret; do not select migrate or run main's unchanged deploy workflow.

No Hostinger SSH access is required for this approach once the existing Actions credential authenticates. No merge/production deployment is included in this verification task.
