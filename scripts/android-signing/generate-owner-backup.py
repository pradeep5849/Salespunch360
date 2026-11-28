#!/usr/bin/env python3
"""Generate only after archive preflight; export with password-based 7z AES-256."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import py7zr
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


def encrypt_bundle(bundle, archive, password):
    """Passwords stay in memory, never subprocess arguments or command output."""
    try:
        with py7zr.SevenZipFile(archive, "w", password=password, header_encryption=True,
                               filters=[{"id": py7zr.FILTER_LZMA2, "preset": 6},
                                        {"id": py7zr.FILTER_CRYPTO_AES256_SHA256}]) as encrypted:
            for entry in sorted(bundle.iterdir()):
                encrypted.write(entry, arcname=entry.name)
        with tempfile.TemporaryDirectory(prefix="verify-", dir=bundle.parent) as temporary:
            destination = Path(temporary)
            with py7zr.SevenZipFile(archive, "r", password=password) as encrypted:
                if not encrypted.needs_password() or "7zAES" not in encrypted.archiveinfo().method_names:
                    raise ValueError("AES-256 encryption is required")
                expected = {entry.name for entry in bundle.iterdir()}
                if set(encrypted.getnames()) != expected:
                    raise ValueError("Archive members do not match")
                encrypted.extractall(destination)
            for entry in bundle.iterdir():
                if (destination / entry.name).read_bytes() != entry.read_bytes():
                    raise ValueError("Archive verification failed")
    except Exception:
        raise SigningError("Encrypted export failed; private diagnostics suppressed.") from None


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
    export_password = env.get("ANDROID_KEYSTORE_EXPORT_PASSWORD", "")
    if len(export_password) < 32:
        raise SigningError("Existing export password secret must have at least 32 characters.")
    if export_password in (env["ANDROID_KEYSTORE_PASSWORD"], env["ANDROID_KEY_PASSWORD"]):
        raise SigningError("Export password must differ from both signing passwords.")
    if not shutil.which("keytool"):
        raise SigningError("Java keytool must be installed.")
    os.umask(0o077)
    runner_temp = Path(env["RUNNER_TEMP"])
    output = runner_temp / "salespunch360-signing-export"
    if output.exists():
        raise SigningError("Export directory already exists; refusing overwrite.")
    try:
        with tempfile.TemporaryDirectory(prefix="sp360-signing-private-", dir=runner_temp) as directory:
            work = Path(directory)
            # Prove password encryption and extraction work BEFORE generating any signing key.
            probe = work / "preflight"
            probe.mkdir(mode=0o700)
            (probe / "probe.txt").write_bytes(b"SalesPunch360 archive validation\n")
            encrypt_bundle(probe, work / "preflight.7z", export_password)
            shutil.rmtree(probe)
            (work / "preflight.7z").unlink()
            signing_env = {k: v for k, v in env.items()
                           if k not in ("ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_EXPORT_PASSWORD")}
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
            output.mkdir(mode=0o700)
            archive = output / "salespunch360-owner-backup.7z"
            # The artifact directory receives ciphertext only, never plaintext credentials.
            encrypt_bundle(bundle, archive, export_password)
            archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
            checksum = f"{archive_hash}  {archive.name}\n"
            (output / "salespunch360-owner-backup.7z.sha256").write_text(checksum)
            (output / "certificate-fingerprints.txt").write_text(fingerprints)
            print(fingerprints + "Archive SHA-256: " + archive_hash)  # Public metadata only.
            if env.get("GITHUB_STEP_SUMMARY"):
                with open(env["GITHUB_STEP_SUMMARY"], "a") as summary:
                    summary.write("### Public signing certificate fingerprints\n\n```text\n" + fingerprints + "```\n\nEncrypted archive SHA-256: `" + archive_hash + "`\n")
    except BaseException:
        shutil.rmtree(output, ignore_errors=True)
        raise


if __name__ == "__main__":
    try:
        generate()
    except SigningError as error:
        raise SystemExit(str(error)) from None
