# Public stylesheet and image loading

The public site loads `src/app/(marketing)/public-shared.css` plus the marketing styles. Workspace, admin, sign-in, registration, verification and offline layouts additionally load the unchanged application styles. This keeps application-only selectors out of a fresh public-page request without removing rules needed by signed-in users.

The shared subset preserves the source cascade, media queries, variables, tag selectors and selectors whose class names occur in public components/styles. It deliberately retains conservative false positives. After changing shared styles or introducing public classes, run:

```sh
node scripts/public-styles.mjs
```

Commit the generated stylesheet. `npm run build` checks synchronization before building. Never remove application selectors simply because a homepage coverage report labels them unused.

The homepage hero and two product images use responsive `sizes` matching their distinct layout positions. Their source assets, visual layout and Next image optimization remain intact. Browser compatibility transforms remain enabled for supported Android/browser versions.

Build Lighthouse measures the production application on a fixture-backed local server. The separate live audit measures Hostinger/CDN delivery; a successful build audit cannot establish that an external HTTP 403 is resolved. CDN and WAF protection remain unchanged.
