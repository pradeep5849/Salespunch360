# One-time Android signing key: owner-encrypted export

This change prepares generation only. **Do not run it until the owner has established and verified the recipient encryption key and checked for an existing production Android signing key.** The production APK workflow remains unchanged. No Firebase configuration or secret is changed.

## Before the first run

1. Check existing production signing keys, including previous maintainers, offline backups and any Play App Signing setup. Reuse an existing production key; never use this generator to replace it. The workflow also refuses a nonempty `ANDROID_KEYSTORE_BASE64`, a previous successful generation run, any earlier backup artifact, or a rerun attempt. These checks cannot detect a key held outside GitHub.
2. On a trusted owner-controlled computer, create or select an **OpenPGP key with an encryption-capable key/subkey**. Keep the private key and its passphrase offline in secure storage. Neither belongs in a workflow input, repository secret, chat, or artifact. An ASCII-armored PUBLIC key and its full fingerprint are safe to supply as workflow inputs.
3. Export the PUBLIC key and obtain its fingerprint on that computer:
   ```sh
   gpg --list-keys --with-subkey-fingerprint
   gpg --armor --export OWNER_PRIMARY_FINGERPRINT > owner-public.asc
   base64 < owner-public.asc | tr -d '\r\n' > owner-public.asc.base64
   ```
   Verify the full primary fingerprint through an independent trusted channel before pasting it. Use the PUBLIC key only. The workflow checks the full fingerprint and proves it can encrypt before generating the Android key. An expired, revoked, unusable or signing-only recipient must fail this preflight.
4. Ensure the existing repository secrets `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD` each contain at least 32 characters and `ANDROID_KEY_ALIAS` is `salespunch360`. Existing values are used, not regenerated or exposed. GitHub cannot reveal old values. The matching values will be inside the encrypted owner backup. No personal access token or Secrets API access is required.
5. Configure the GitHub Environment **android-signing-key-generation** with appropriate trusted reviewers and main-only deployment restrictions before use. The workflow independently enforces the repository-owner actor, `main`, first run attempt, and an explicit acknowledgement. Merely naming an Environment does not automatically establish reviewer protection. Repository administrators must configure and review it themselves.
6. Review and merge the generation PR only when satisfied. The workflow intentionally rejects execution on a feature branch. Neither PR CI nor pushes trigger key generation.

## Manual generation

As repository owner, choose **Actions → One-time Android signing key generation → Run workflow → main**.

- `recipient_public_key_base64`: contents of `owner-public.asc.base64` (public material).
- `recipient_fingerprint`: full primary fingerprint without spaces.
- `confirmation`: `GENERATE_NEW_SALESPUNCH360_KEY` only if no production key exists anywhere.
- `owner_ready`: confirm control of the matching private key and responsibility to download, decrypt and verify the backup.

The workflow uses `keytool` to generate a JKS private key with alias `salespunch360`, RSA 3072 bits and validity 10,000 days. Passwords are passed by environment reference rather than command-line values. Temporary files have restrictive permissions and are removed on success or failure. The public recipient is isolated in a temporary GnuPG home; signing credentials are not supplied to GnuPG. Only the encrypted archive and public certificate fingerprints enter the artifact directory. Upload is successful-run-only; there is no plaintext fallback.

## Owner download and offline backup

The artifact **salespunch360-signing-owner-backup** is retained for **7 days**. Repository workflow readers may be able to download it, especially in a public repository; artifact access is **not** the secrecy boundary. The OpenPGP encryption is. Only the holder of the matching recipient private key can decrypt the archive.

Download it promptly. On the trusted owner computer:

```sh
umask 077
gpg --output salespunch360-owner-backup.tar.gz --decrypt salespunch360-owner-backup.tar.gz.gpg
mkdir -m 700 salespunch360-offline-backup
tar -xzf salespunch360-owner-backup.tar.gz -C salespunch360-offline-backup
```

The encrypted backup contains:

- `salespunch360.jks`
- `salespunch360.jks.base64` — add this manually as `ANDROID_KEYSTORE_BASE64` in GitHub repository settings.
- `signing-credentials.json` — matching existing store password, key password and alias. Keep private; do not upload it as an artifact or source file.
- `certificate-fingerprints.txt` — public SHA-1 and SHA-256 fingerprints for the actual Android certificate.
- `README.txt`

Verify the keystore using `keytool -list -v -keystore salespunch360-offline-backup/salespunch360.jks -alias salespunch360` and enter the store password locally at its prompt. Compare its SHA-1 and SHA-256 with the workflow summary and public fingerprint file. Store at least two secure offline backups under the owner's control, verify recovery, and protect the OpenPGP private key and passphrase separately. Do not treat the expiring Actions artifact as the permanent backup. The workflow cannot certify that the owner actually downloaded or tested recovery.

The `.base64` file is a reversible encoding of the private keystore, **not encryption**. Keep it as private as the JKS. Keep extracted files in encrypted local storage; do not paste passwords, Base64 or private keys into chat or logs.

## After owner confirmation

Once the owner has verified the offline backup and manually configured `ANDROID_KEYSTORE_BASE64`, prepare a **separate** PR changing the production APK workflow to restore that keystore, use the three existing matching secrets, sign/verify the APK and remove runner copies. Run two signed builds and compare their public fingerprints. Nothing in this generation PR changes APK signing, Android signing configuration, Firebase secrets, payments or production functionality.

No public Android signing fingerprints can be supplied before a real key is generated. The real workflow prints only those public fingerprints; validation uses mocks and generates no private key. Do not rerun this generator to test certificate stability.
