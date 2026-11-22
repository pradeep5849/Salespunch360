# A121-F03 — Separate native geofence and tracking requirements

Bootstrap exposes the authoritative attendance geofence flag independently from GPS tracking, with an optional/defaulted Android DTO field for compatibility. All three native attendance entry surfaces now use the same location policy: tracking requests location for start/end, geofence-only requests it for start, and neither policy requests it for neither action. A no-location action bypasses the location permission prompt and acquisition and submits the already-supported nullable request. Existing server policy checks remain authoritative; no geofence bypass, tracking setting or stored location policy changed.

The callback chain now carries nullable location consistently. Success/stop confirmations remain based on the server response. Tracking recovery remains its separate A121-F04 finding; branch selection remains A121-F02.

Thirty focused mobile authorization/attendance/bootstrap checks passed, including independent geofence/tracking bootstrap state; TypeScript (4 GB heap), changed-file lint and whitespace passed. Three JVM policy cases were added; native compile/JVM/lint and real permission/device acceptance remain pending. Previous full suite: 4236 passed / 453 optional skipped. No production setting/data change, migration, deployment or merge.
