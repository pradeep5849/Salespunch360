# A118 Period Locks implementation batch

21 November 2026. Based on application 09fb3fc7. A118-F03: shared transaction refuses active closed years before lock/audit writes. Web already offers open years; Android lock picker now filters open years. A118-F02: web consequence review, required confirmation, pending button and explicit success/error state; Android consequence text/confirmation required before submitting. Existing permission and forward-only/transaction rules retained. No real lock advanced.

Validation: 27 focused accounting tests passed, including new closed-year no-write regression; changed web/backend ESLint passed; full TypeScript passed with Node heap 4096 MB (initial default-heap run exhausted memory). Android source changes require CI build/lint and device interaction. Native success/current-lock review is now implemented; A118-F02 remains IMPLEMENTED BUT NOT VERIFIED until final UI/device acceptance. A118-F03 implemented but final SQL/platform acceptance remains limited. No FIXED + VERIFIED declaration or deployment.

Native follow-up: selected year bounds/current lock are now shown inside the dialog; date edits reset confirmation; malformed/out-of-bounds/backward dates disable submission. Native server errors stay visible within the open dialog, and successful saves show an explicit status after refresh. Physical Android acceptance remains outstanding.

Final focused local suite: 33 passed (27 accounting, six confirmation/action feedback cases); additional test-file lint passed. Latest application source requires final-head CI/platform verification. Live Lighthouse jobs failed again; this does not waive other checks or establish the cause without reading their logs.
