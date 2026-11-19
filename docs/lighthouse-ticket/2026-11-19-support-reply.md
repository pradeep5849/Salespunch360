# Fresh GitHub Actions verification — 19 November 2026

We reran the original Public website mobile and desktop audit workflow against current main (5096fc8a9b8aa5f13bb625ee62163ad40c327e02).

Run: https://github.com/pradeep5849/Salespunch360/actions/runs/44502317241

Both Lighthouse tests failed on GET https://www.salespunch360.com/ with HTTP 403. These are new failures on 19 November, not only the 10 November incident. Each job's preceding curl GET succeeded with HTTP 200, so the successful curl/PageSpeed tests do not establish that Chrome running on these GitHub runners is allowed.

| Test | Error logged at (UTC) | HTTP | x-hcdn-request-id | CDN server address |
| --- | --- | --- | --- | --- |
| Desktop | 2026-11-19 10:05:32 | 403 | 5ed6f704abe9de586208a8f6741a54ea-bos-edge13 | 147.79.79.117 |
| Mobile | 2026-11-19 10:05:52 | 403 | ed058b1a7a0f493cfe3f71f3b81dba1c-imm-edge8 | 195.35.60.121 |

These addresses are remote CDN servers observed by Chrome, NOT the GitHub runner's source/client IP. Both document responses report server=hcdn, HTTP/2, content-type=text/html, with no service-worker or disk-cache response. Lighthouse browser UAs were ordinary Chrome/157.0.0.0 desktop macOS and Android 11 mobile strings. No valid performance score was produced by either failed run.

Desktop job: https://github.com/pradeep5849/Salespunch360/actions/runs/44502317241/job/135484986572
Mobile job: https://github.com/pradeep5849/Salespunch360/actions/runs/44502317241/job/135484985842

Please trace these specific edge request IDs and the workflow's browser-document request to identify and correct the false positive affecting legitimate GitHub Actions Lighthouse traffic. Keep CDN/WAF protection enabled. The evidence alone does not isolate the exact IP, fingerprint, rule or rate trigger; please determine that from edge logs. A broad user-agent allowlist is not requested.

## Dependency finding

Current local installed dependency tree includes minimatch 3.1.5, 5.1.9 and 11.0.4. Versions 3.1.5 and 5.1.9 fall outside the ticket's cited affected interval >=7.0.0 <11.0.1; 11.0.4 is above it. Fresh npm audit reports no minimatch vulnerability. This supports reviewing scanner/advisory matching, but does not prove all unrelated minimatch advisories or server-installed trees are unaffected. Please provide the scanner finding/advisory IDs, scanned lockfile/artifact version and affected-range records if those findings persist.

Fresh npm audit does report one separate LOW fast-xml-parser finding (GHSA-474x-hrwr-fgx4, range <=5.11.2). This was not changed during verification and is not the minimatch finding discussed in the ticket.

No application, dependencies, DNS, CDN, WAF or hosting settings were changed. This file is prepared for the user to send; no support message was sent by the assistant.
