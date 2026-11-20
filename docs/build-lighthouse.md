# Lighthouse measurements

`build-lighthouse.yml` measures the production Next.js build on the GitHub runner at `http://127.0.0.1:3000/`, separately for mobile and desktop. It uses a disposable PostgreSQL fixture database, generated fixture credentials, and the normal migration-gated production build. It requires no production secrets and does not create production business records or send notifications.

The workflow fails if the build, local server, Lighthouse collection, or report generation fails. It collects scores without adding new score thresholds; the existing public audit also collects scores without a numeric score gate. Reports are stored as private repository Actions artifacts for seven days and labelled `ci-production-build`. An empty fixture database can produce different public content from production.

`public-site-audit.yml` remains unchanged and continues auditing the live Hostinger/CDN path. Local build scores do not establish that a live-site 403 is fixed, and do not measure production database latency, CDN behavior, or real network delivery.

For the live-site 403, Hostinger support needs the failing URL/method, UTC timestamp, and `x-hcdn-request-id` from each failed browser request. Keep CDN/WAF protection enabled while requesting a targeted false-positive correction. No broad user-agent allowlist is required by this workflow.
