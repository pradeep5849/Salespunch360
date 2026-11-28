# Permanent production test APK signing

The owner confirmed the real `ANDROID_KEYSTORE_BASE64` has been configured after [permanent key generation](https://github.com/pradeep5849/Salespunch360/actions/runs/46139556845). Never regenerate or replace that key.

The manually dispatched **Android production test APK** workflow now uses the existing four signing secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, and `ANDROID_KEY_ALIAS`. It does not use the export password or encrypted backup for ordinary builds. No secret values are supplied through workflow inputs or CLI arguments.

Before Firebase injection or Gradle builds, the helper decodes the JKS in a private runner directory, validates the alias/store password, compares both public certificate fingerprints with `scripts/android-signing/permanent-certificate.json`, and proves access to the existing private key using the key password. The proof signs a public certificate request in memory; it does not generate or modify a private key or publish the request.

The release is built unsigned as before. It is zip-aligned and signed with the validated permanent key using environment password references. Verification requires exactly one APK signer, matching SHA-1 **and** SHA-256, valid APK signatures and zip alignment. The existing production URL/cleartext-network checks remain. Only the verified APK and public certificate report can be uploaded. Any failure stops the workflow; no temporary signing or key-generation fallback exists. Signing material and the existing temporary Firebase configuration are removed under `if: always()`.

Pinned public fingerprints:

```text
SHA-1: 74:20:65:88:58:7E:EF:EF:05:85:98:D8:4F:86:E5:DB:2F:05:AA:46
SHA-256: 69:EB:04:B6:F9:5E:95:F5:49:4A:74:9B:2C:A0:17:75:18:B8:46:45:3D:B2:D0:90:28:4A:A8:24:2D:75:EE:D6
```

Only the repository owner can dispatch permanent signing. During this PR's validation, the owner-authorized workflow may run on its reviewed branch to validate the actual stored key and signed APK before merge; the final production test build runs from main after merge. Normal PR validation tests use mocks and no signing secrets. A successful branch build and main build must report the same pinned certificate.

Download **SalesPunch360-production-test-apk** from the successful main workflow run; it includes the APK and public certificate report and expires after seven days. Keep permanent offline keystore backups and passwords safe. This workflow never publishes to Google Play and changes no Android application code, Firebase configuration, payments or database settings.
