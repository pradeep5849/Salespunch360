# Temporary development dependency risk acceptance

Reviewed on 2026-10-04 for the release configuration changes.

`npm audit` reports five high-severity entries: `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`, and `eslint-config-next`. These form one affected dependency chain. The root advisory is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): deeply nested patterns can exhaust the stack in `braces` versions through 3.0.3. The registry still lists 3.0.3 as its latest release at review time.

This chain is development-only in the current lockfile, used by lint tooling rather than application request processing. Developers and CI remain exposed when linting untrusted repository input. CI permissions are read-only; untrusted pull requests must not receive production secrets or production database access. Production installations should omit development dependencies when supported by the deployment artifact and runtime requirements.

Temporarily accept this tooling denial-of-service risk rather than apply npm's suggested major downgrade of `eslint-config-next` to 14.2.35, which does not match the Next.js 16 application. No vulnerable override or forced downgrade is added. The vulnerability remains unresolved.

Recheck before every release and by 2026-11-04. Remove this acceptance when a compatible patched chain is available, regenerate the lockfile, and run lint, typecheck, the full suite, and the production build.
