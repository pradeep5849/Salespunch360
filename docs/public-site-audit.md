# SalesPunch360 public-site audit

## Verified baseline

Hostinger is connected. The active Next.js deployment is revision 887402cf9868ca3df800513dd8e776c0b1874ff9, on Node.js 22 with Git deployment from main. SSL, HTTPS redirection and CDN are enabled.

Hostinger agent readiness scanner v4 returned **57/100 (D)** for www.salespunch360.com on 5 November 2026. Public HTML readability, normal metadata, crawler access, sitemap declaration, status codes and pricing links passed. Failed checks included content signals, sitemap dates, JSON-LD/Organization/social identity, machine-readable contact, llms.txt, Markdown content negotiation and optional agent interaction protocols.

## Proposed fixes

- Publish Organization, WebSite and all three product editions as JSON-LD in the existing public footer. Use only existing admin-configured, validated social profiles for sameAs. Add the telephone already published by the site's WhatsApp link as a visible contact link.
- Provide llms.txt and an explicit Markdown representation of the public product information. Preserve normal HTML/RSC responses, canonical redirects, private-route authorization and content-security policy behavior.
- Keep existing robots exclusions and add signals permitting search and AI-input use. No new training permission is stated.
- Add missing public routes and published blog URLs to the sitemap. Static-page timestamps are recorded from real source changes, not request time; blog timestamps come from published records. Run `node scripts/update-public-sitemap-dates.mjs` when public content changes and include the resulting JSON in the commit.
- Dedupe public settings reads within a server render, without caching admin settings across requests. Stop prioritizing the below-the-fold footer logo.

Optional WebMCP tools and an MCP Server Card are not implemented. The site has no declared public agent API; a scanner score alone does not define product requirements.

## Mobile and desktop performance attempts

Reproducible Lighthouse 13.6.0 audits run in `.github/workflows/public-site-audit.yml`, with public reports as workflow artifacts. The runner uses Node.js 22 and Google Chrome 156.

The initial mobile run received HTTP 403, while the initial desktop run failed to start Chrome. After explicitly selecting the Chrome binary, **both browser audits received HTTP 403**. Normal HTTP requests from the same runners returned **200**, with Hostinger CDN headers. The measured origin response header was about 0.294–0.349 seconds on those normal requests; this is not a Lighthouse score or an end-user speed measurement.

No valid mobile or desktop performance scores were obtained. Do not interpret the error-page reports as measurements of the application or claim a score improvement. The browser-specific access restriction must be resolved before diagnosing the largest measured performance opportunities.

## hPanel action

Open Websites → salespunch360.com → Manage site → Performance → CDN → Manage. Review the Security level and Traffic blocking rules. Ask Hostinger support to investigate legitimate Lighthouse browser requests returning 403 while ordinary requests return 200. The diagnostic workflow logs contain the public URL, run timestamps and response diagnostics. Keep protection for private app routes; do not disable the CDN or all security features to obtain a passing score.

Official guidance:
- https://www.hostinger.com/support/hostinger-cdn-how-to-fix-blocked-legitimate-requests/
- https://www.hostinger.com/support/hostinger-cdn-troubleshooting-website-errors/

No passwords or private credentials are required for these source changes. Existing production environment variables should be preserved. Official social profiles can be entered in the application's existing admin public-site settings. SMTP configuration stays private in hPanel; do not copy masked values or passwords into code.

## Verification and rollout

Targeted tests cover structured data, social-link validation, robots/Markdown content, sitemap coverage and publication filters, canonical redirects, RSC negotiation and private-route CSP behavior. The full production build uses temporary local fixture configuration and does not query production data.

This PR does not deploy. Merging main automatically updates the existing production app, so deployment requires owner approval. After deployment, clear the website/CDN cache through Hostinger, rerun agent readiness, and rerun both Lighthouse audits after browser access is resolved.

## Follow-up origin-log evidence

The owner reports that Hostinger support found GET / and assets returning 200 during 14:15:55–14:16:30 UTC, no matching origin 403, WAF disabled, and no configured IP/country deny rules, JavaScript challenge or CAPTCHA. These records do not establish an application-level cause or a WAF cause. Capture the actual failing browser document response, request ID and service-worker/cache provenance before attributing the 403 to any particular layer. The updated audit saves DevTools network logs and prints selected non-cookie response headers for that purpose.
