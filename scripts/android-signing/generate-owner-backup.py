#!/usr/bin/env python3
"""Generate only after recipient validation; export signing material encrypted."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import tarfile
import tempfile


class SigningError(Exception):
    pass


def run(command, *, data=None, env=None):
    try:
        return subprocess.run(command, input=data, env=env, check=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout
    except (OSError, subprocess.CalledProcessError):
        # Tool diagnostics must never echo signing credentials into Actions logs.
        raise SigningError("Signing tool failed; private diagnostics suppressed.") from None


def generate(environment=None):
    env = dict(os.environ if environment is None else environment)
    if env.get("GITHUB_ACTIONS") != "true":
        raise SigningError("This entry point requires the guarded Actions workflow.")
    if env.get("ANDROID_KEYSTORE_BASE64"):
        raise SigningError("Existing signing keystore secret found; refusing replacement.")
    if env.get("ANDROID_KEY_ALIAS") != "salespunch360":
        raise SigningError("Existing alias secret must match salespunch360.")
    if any(len(env.get(k, "")) < 32 for k in
           ("ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD")):
        raise SigningError("Both existing signing password secrets must have at least 32 characters.")
    fingerprint = env.get("RECIPIENT_FINGERPRINT", "").upper()
    if not re.fullmatch(r"(?:[0-9A-F]{40}|[0-9A-F]{64})", fingerprint):
        raise SigningError("Provide the full public-key fingerprint without spaces.")
    try:
        public_key = base64.b64decode(env.get("RECIPIENT_PUBLIC_KEY_BASE64", ""), validate=True)
    except ValueError:
        raise SigningError("Recipient public-key Base64 is invalid.") from None
    if not public_key or len(public_key) > 65536:
        raise SigningError("Recipient public key must be between 1 and 65536 bytes.")
    if any(not shutil.which(tool) for tool in ("gpg", "keytool")):
        raise SigningError("GnuPG and Java keytool must be installed.")
    os.umask(0o077)
    runner_temp = Path(env["RUNNER_TEMP"])
    output = runner_temp / "salespunch360-signing-export"
    if output.exists():
        raise SigningError("Export directory already exists; refusing overwrite.")
    # Recipient preparation must not receive Android signing credentials.
    public_env = {k: v for k, v in env.items() if not k.startswith("ANDROID_")}
    try:
        with tempfile.TemporaryDirectory(prefix="sp360-signing-private-", dir=runner_temp) as directory:
            work = Path(directory)
            home = work / "gnupg"
            home.mkdir(mode=0o700)
            gpg = ["gpg", "--no-options", "--homedir", str(home), "--batch", "--no-tty"]
            recipient_file = work / "recipient.asc"
            recipient_file.write_bytes(public_key)
            listed = run(gpg + ["--with-colons", "--import-options", "show-only",
                                "--import", str(recipient_file)], env=public_env).decode()
            records = [line.split(":") for line in listed.splitlines()]
            if any(r[0] in ("sec", "ssb") for r in records):
                raise SigningError("Supply only an OpenPGP PUBLIC key, never a private key.")
            if sum(r[0] == "pub" for r in records) != 1:
                raise SigningError("Exactly one owner public key is required.")
            primary = next((r[9] for r in records if r[0] == "fpr"), "")
            if primary != fingerprint:
                raise SigningError("Owner public-key fingerprint does not match.")
            run(gpg + ["--import", str(recipient_file)], env=public_env)
            encrypt = gpg + ["--trust-model", "always", "--no-encrypt-to", "--recipient", fingerprint,
                             "--cipher-algo", "AES256", "--encrypt"]
            # Prove the public key can encrypt (not revoked/expired/sign-only) BEFORE key generation.
            run(encrypt, data=b"SalesPunch360 owner recipient validation\n", env=public_env)
            signing_env = {k: v for k, v in env.items() if k != "ANDROID_KEYSTORE_BASE64"}
            bundle = work / "bundle"
            bundle.mkdir(mode=0o700)
            keystore = bundle / "salespunch360.jks"
            run(["keytool", "-genkeypair", "-noprompt", "-storetype", "JKS",
                 "-keystore", str(keystore), "-storepass:env", "ANDROID_KEYSTORE_PASSWORD",
                 "-keypass:env", "ANDROID_KEY_PASSWORD", "-alias", "salespunch360",
                 "-keyalg", "RSA", "-keysize", "3072", "-validity", "10000",
                 "-dname", "CN=SalesPunch360 Android Signing,O=SalesPunch360"], env=signing_env)
            certificate = run(["keytool", "-exportcert", "-rfc", "-keystore", str(keystore),
                               "-storepass:env", "ANDROID_KEYSTORE_PASSWORD", "-alias", "salespunch360"],
                              env=signing_env).decode()
            der = ssl.PEM_cert_to_DER_cert(certificate)
            def digest(algorithm):
                return ":".join(re.findall("..", hashlib.new(algorithm, der).hexdigest().upper()))
            fingerprints = f"Alias: salespunch360\nSHA-1: {digest('sha1')}\nSHA-256: {digest('sha256')}\n"
            (bundle / "salespunch360.jks.base64").write_text(base64.b64encode(keystore.read_bytes()).decode() + "\n")
            (bundle / "signing-credentials.json").write_text(json.dumps({
                "ANDROID_KEY_ALIAS": "salespunch360",
                "ANDROID_KEYSTORE_PASSWORD": env["ANDROID_KEYSTORE_PASSWORD"],
                "ANDROID_KEY_PASSWORD": env["ANDROID_KEY_PASSWORD"],
            }, indent=2) + "\n")
            (bundle / "certificate-fingerprints.txt").write_text(fingerprints)
            (bundle / "README.txt").write_text(
                "PRIVATE OFFLINE BACKUP. Keep this directory in encrypted owner-controlled storage.\n"
                "Add salespunch360.jks.base64 to ANDROID_KEYSTORE_BASE64 manually.\n"
                "Passwords/alias match the existing repository secrets at generation time.\n"
                "Do not upload this plaintext directory or credentials to GitHub.\n")
            archive = work / "owner-backup.tar.gz"
            with tarfile.open(archive, "w:gz") as tar:
                for entry in sorted(bundle.iterdir()):
                    tar.add(entry, arcname=entry.name)
            output.mkdir(mode=0o700)
            # No plaintext or unencrypted archive is ever placed in the artifact directory.
            run(encrypt + ["--output", str(output / "salespunch360-owner-backup.tar.gz.gpg"),
                            str(archive)], env=public_env)
            (output / "certificate-fingerprints.txt").write_text(fingerprints)
            print(fingerprints, end="")  # Public certificate metadata only.
            if env.get("GITHUB_STEP_SUMMARY"):
                with open(env["GITHUB_STEP_SUMMARY"], "a") as summary:
                    summary.write("### Public signing certificate fingerprints\n\n```text\n" + fingerprints + "```\n")
    except BaseException:
        shutil.rmtree(output, ignore_errors=True)
        raise


if __name__ == "__main__":
    try:
        generate()
    except SigningError as error:
        raise SystemExit(str(error)) from None
