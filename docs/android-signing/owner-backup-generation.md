# One-time Android signing key: password-encrypted owner export

This PR prepares generation only. **Do not run it until validation passes and the owner explicitly approves generation and confirms secure export-password storage.** The production APK workflow remains unchanged. No Firebase configuration or secret is changed. OpenPGP keys are not required.

## Before the first run

1. Check for an existing production signing key, including previous maintainers, offline backups and Play App Signing. Reuse an existing production key; never use this generator to replace it. The workflow refuses a nonempty `ANDROID_KEYSTORE_BASE64`, a previous successful generation run, any earlier backup artifact, or a rerun attempt. These checks cannot detect a key held outside GitHub.
2. Create a cryptographically random export password of **at least 32 characters** in a trusted password manager. Keep an owner-controlled offline backup. Manually save the same value as the repository secret **ANDROID_KEYSTORE_EXPORT_PASSWORD**. It must differ from both signing passwords. Do not send it in chat or a workflow input. GitHub cannot reveal it after saving; losing this password means losing access to the encrypted backup.
3. Retain the existing repository secrets `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD` and `ANDROID_KEY_ALIAS`. Both signing passwords must each have at least 32 characters; the alias must be `salespunch360`. The workflow uses existing values, not newly generated passwords. Matching signing credentials are included inside the encrypted backup. The export password itself is not included. No personal access token or Secrets API access is required.
4. On the owner's Android device, have an app supporting **AES-256 encrypted 7z archives and encrypted filenames**, such as ZArchiver. Default Files/ZIP extractors may not support this format. Desktop 7-Zip can also extract it. The PR validates interoperability using the official 7-Zip extractor and synthetic files; it does not claim an on-device Android test.
5. Configure the GitHub Environment **android-signing-key-generation** with trusted reviewers and main-only deployment restrictions. Naming an Environment does not automatically configure reviewer protection. The workflow independently enforces the repository-owner actor, `main`, first run attempt and explicit acknowledgement. Repository administrators must configure and review Environment protection themselves.
6. Review and merge the generation PR when validation is satisfactory. **Merging does not generate a key.** The generator has only `workflow_dispatch`; pushes and PR CI cannot trigger it. Obtain the owner's separate approval before manually dispatching it. It intentionally rejects feature-branch runs.

## Manual generation after approval

As repository owner, choose **Actions → One-time Android signing key generation → Run workflow → main**.

- `confirmation`: `GENERATE_NEW_SALESPUNCH360_KEY`, only if no production key exists anywhere.
- `owner_ready`: confirm the export password is safely stored and responsibility for downloading, decrypting and verifying the offline backup.

There are no password or public-key workflow inputs. Passwords are supplied only by repository secrets. Before any signing key is generated, the helper checks the export password and verifies an AES-256 encryption/extraction round-trip using harmless probe data. Keytool then generates a JKS using RSA 3072 bits, alias `salespunch360`, and validity 10,000 days. Signing passwords are passed by environment reference, not command-line values. The export password is not passed to keytool.

Encryption uses the standard **7zAES AES-256/SHA-256 password derivation** with encrypted archive headers/filenames. The library receives the export password in memory, not through a command-line argument, password file or log. Python 3.12 and all archive-library versions/wheel hashes are pinned. The completed archive is decrypted and compared byte-for-byte in temporary private storage before upload. Only ciphertext and public metadata enter the artifact directory. There is no plaintext fallback. All temporary private files and exported runner copies are removed on success or failure.

## Owner download and offline backup

Download artifact **salespunch360-signing-owner-backup** promptly; it expires after **7 days**. It contains:

- `salespunch360-owner-backup.7z` — password-encrypted JKS, Base64, matching signing credentials and public fingerprints.
- `salespunch360-owner-backup.7z.sha256` — public ciphertext checksum.
- `certificate-fingerprints.txt` — public SHA-1/SHA-256 certificate fingerprints.

GitHub may wrap these files in an ordinary ZIP download. Extract that outer ZIP, then open the inner `.7z` with the export password. The outer ZIP is not the encryption boundary. Repository workflow readers may be able to download the ciphertext, especially in a public repository; the strong private export password protects the signing material. Never publish or share that password.

Compare the archive's SHA-256 with the value in the workflow summary through your authenticated GitHub session before extraction. In ZArchiver, open the `.7z`, choose a private destination and enter the export password locally. On desktop, `7zz x salespunch360-owner-backup.7z` prompts for it; do not put the real password in command-line arguments or shell history.

The decrypted backup contains:

- `salespunch360.jks`
- `salespunch360.jks.base64` — manually configure this file's contents as `ANDROID_KEYSTORE_BASE64`.
- `signing-credentials.json` — matching store password, key password and alias. Keep private; never commit or upload plaintext.
- `certificate-fingerprints.txt`
- `README.txt`

Verify the JKS with `keytool -list -v -keystore salespunch360.jks -alias salespunch360`, entering its store password at the prompt. Compare SHA-1 and SHA-256 with the workflow summary and public fingerprint file. Store two secure owner-controlled offline backups and test recovery. Keep the export password separately in a password manager/offline backup. The expiring Actions artifact is not the permanent backup, and the workflow cannot certify that the owner actually downloaded and recovered it.

Base64 is reversible encoding, **not encryption**. Protect the `.base64` as carefully as the JKS. Keep extracted credentials in encrypted local storage, never a public/shared Android download folder, chat or logs.

## After owner confirmation

After the owner verifies the offline backup and manually configures `ANDROID_KEYSTORE_BASE64`, use a separate PR to update the production APK workflow to restore the permanent keystore, reuse the three matching signing secrets, sign/verify APKs and remove runner copies. Run two signed builds and compare their public fingerprints. This PR changes no production APK workflow, Android application signing settings, Firebase configuration, payment functionality or database configuration.

No real signing key or public signing fingerprints exist yet. Validation mocks keytool; real encryption/extraction tests use synthetic non-key files only. A real generation prints public SHA-1/SHA-256 fingerprints separately from the encrypted archive. Never rerun the generator just to test signing-certificate stability.
