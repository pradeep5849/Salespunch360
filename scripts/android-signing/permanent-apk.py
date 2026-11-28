#!/usr/bin/env python3
"""Validate and reuse the existing signing key. Never generate or replace a key."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import sys


class SigningError(Exception):
    pass


def expected_certificate():
    return json.loads(Path(__file__).with_name("permanent-certificate.json").read_text())


def run(command, env):
    try:
        tool_env = {key: value for key, value in env.items() if key != "ANDROID_KEYSTORE_BASE64"}
        return subprocess.run(command, env=tool_env, check=True, stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE).stdout
    except (OSError, subprocess.CalledProcessError):
        raise SigningError("Permanent signing tool failed; private diagnostics suppressed.") from None


def normalize(value):
    return value.replace(":", "").upper()


def signing_directory(env):
    return Path(env["RUNNER_TEMP"]) / "salespunch360-permanent-signing"


def credentials(env):
    expected = expected_certificate()
    if env.get("ANDROID_KEY_ALIAS") != expected["alias"]:
        raise SigningError("Permanent signing alias is missing or does not match the approved alias.")
    if any(not env.get(key) for key in ("ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD")):
        raise SigningError("Both permanent signing password secrets are required.")
    return expected


def validate_keystore(path, env):
    expected = credentials(env)
    if not path.is_file() or path.read_bytes()[:4] != b"\xfe\xed\xfe\xed":
        raise SigningError("The permanent JKS keystore is missing or invalid.")
    certificate = run(["keytool", "-exportcert", "-rfc", "-storetype", "JKS", "-keystore", str(path),
                       "-storepass:env", "ANDROID_KEYSTORE_PASSWORD", "-alias", expected["alias"]], env)
    try:
        der = ssl.PEM_cert_to_DER_cert(certificate.decode())
    except (ValueError, UnicodeError):
        raise SigningError("Cannot read permanent public certificate.") from None
    for algorithm in ("sha1", "sha256"):
        if hashlib.new(algorithm, der).hexdigest().upper() != normalize(expected[algorithm]):
            raise SigningError("Keystore certificate does not match the approved permanent certificate.")
    # A signed certificate request proves private-key access with the key password.
    # This reuses the existing key; no new key is generated and no CSR is exported.
    run(["keytool", "-certreq", "-storetype", "JKS", "-keystore", str(path),
         "-storepass:env", "ANDROID_KEYSTORE_PASSWORD", "-keypass:env", "ANDROID_KEY_PASSWORD",
         "-alias", expected["alias"]], env)
    return expected


def prepare(env):
    credentials(env)
    encoded = env.get("ANDROID_KEYSTORE_BASE64", "")
    if not encoded or len(encoded) > 262144:
        raise SigningError("A valid ANDROID_KEYSTORE_BASE64 secret is required; no signing fallback exists.")
    try:
        data = base64.b64decode("".join(encoded.split()), validate=True)
    except ValueError:
        raise SigningError("Permanent keystore Base64 is invalid.") from None
    os.umask(0o077)
    directory = signing_directory(env)
    if directory.exists():
        raise SigningError("Signing directory already exists; refusing overwrite.")
    directory.mkdir(mode=0o700)
    try:
        path = directory / "salespunch360.jks"
        path.write_bytes(data)
        return validate_keystore(path, env)
    except BaseException:
        shutil.rmtree(directory, ignore_errors=True)
        raise


def tools(env):
    return Path(env["ANDROID_SDK_ROOT"]) / "build-tools" / "35.0.0"


def verify_apk(apk, env):
    if not apk.is_file():
        raise SigningError("The production APK is missing.")
    expected = expected_certificate()
    output = run([str(tools(env) / "apksigner"), "verify", "--verbose", "--print-certs", str(apk)], env).decode()
    signers = set(re.findall(r"^Signer #(\d+) certificate SHA-256 digest:", output, re.MULTILINE))
    if signers != {"1"}:
        raise SigningError("Expected exactly one permanent APK signer.")
    for algorithm, label in (("sha1", "SHA-1"), ("sha256", "SHA-256")):
        matches = re.findall(r"^Signer #1 certificate " + label + r" digest: ([0-9a-fA-F:]+)$", output, re.MULTILINE)
        if len(matches) != 1 or normalize(matches[0]) != normalize(expected[algorithm]):
            raise SigningError("APK certificate does not match the approved permanent certificate.")
    run([str(tools(env) / "zipalign"), "-c", "-p", "4", str(apk)], env)
    return expected


def sign(env):
    path = signing_directory(env) / "salespunch360.jks"
    expected = validate_keystore(path, env)
    workspace = Path(env["GITHUB_WORKSPACE"])
    unsigned = workspace / "android/app/build/outputs/apk/release/app-release-unsigned.apk"
    aligned = signing_directory(env) / "aligned.apk"
    final = workspace / "SalesPunch360-production-test.apk"
    if not unsigned.is_file() or final.exists():
        raise SigningError("Expected unsigned release input and a fresh signed APK output.")
    try:
        run([str(tools(env) / "zipalign"), "-f", "-p", "4", str(unsigned), str(aligned)], env)
        run([str(tools(env) / "apksigner"), "sign", "--ks", str(path), "--ks-key-alias", expected["alias"],
             "--ks-pass", "env:ANDROID_KEYSTORE_PASSWORD", "--key-pass", "env:ANDROID_KEY_PASSWORD",
             "--out", str(final), str(aligned)], env)
        verified = verify_apk(final, env)
        report(verified, env, workspace / "SalesPunch360-production-test-certificate.txt")
        return verified
    except BaseException:
        final.unlink(missing_ok=True)
        raise
    finally:
        aligned.unlink(missing_ok=True)


def report(expected, env, destination=None):
    text = f"Alias: {expected['alias']}\nSHA-1: {expected['sha1']}\nSHA-256: {expected['sha256']}\n"
    print(text, end="")  # Public certificate metadata only.
    if destination:
        destination.write_text(text)
    if env.get("GITHUB_STEP_SUMMARY"):
        with open(env["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write("### Verified permanent signing certificate\n\n```text\n" + text + "```\n")


if __name__ == "__main__":
    try:
        env = dict(os.environ)
        if sys.argv[1:] == ["prepare"]:
            report(prepare(env), env)
        elif sys.argv[1:] == ["sign"]:
            sign(env)
        elif sys.argv[1:] == ["verify"]:
            report(verify_apk(Path(env["GITHUB_WORKSPACE"]) / "SalesPunch360-production-test.apk", env), env)
        else:
            raise SigningError("Expected prepare, sign or verify; key generation is not supported.")
    except SigningError as error:
        raise SystemExit(str(error)) from None
