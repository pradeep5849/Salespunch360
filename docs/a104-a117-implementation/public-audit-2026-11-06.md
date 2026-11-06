# Public Lighthouse diagnostics — 6 November 2026

These read-only checks tested the currently deployed https://www.salespunch360.com/, not the unmerged implementation in PR #180. Neither run produced valid speed scores.

| Test | Fetch time (UTC) | Homepage response | x-hcdn-request-id |
| --- | --- | --- | --- |
| Mobile Chrome 156 | 09:26:56.781 | 403, server hcdn | 2a57b103f3b3b82dbf3d51ec028b1cd9-bos-edge9 |
| Desktop Chrome 156 | 09:26:58.568 | 403, server hcdn | 4901b31bc8752f6b5750d25d3bd0329c-bos-edge10 |

The preliminary curl request returned HTTP 200 in both jobs. Browser diagnostics showed real document responses over HTTP/2, not a service-worker or disk-cache response. The favicon returned a separate 404. The `server: hcdn` header establishes that the response passed through Hostinger CDN; it does not independently establish which layer generated the rejection.

Ask Hostinger to trace these request IDs internally for 09:26:55–09:27:05 UTC (14:56:55–14:57:05 India time), identify whether the edge generated or forwarded the 403, and identify the responsible rule or upstream decision. No application, CDN, DNS or security setting was changed in response to these failures.

Evidence: [mobile job](https://github.com/pradeep5849/Salespunch360/actions/runs/42195076413/job/127816176299), [desktop job](https://github.com/pradeep5849/Salespunch360/actions/runs/42195076413/job/127816176146).
