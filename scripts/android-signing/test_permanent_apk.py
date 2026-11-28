"""No real keys: subprocesses are mocked; production validation runs only on dispatch."""
import base64
import contextlib
import io
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("permanent_apk", Path(__file__).with_name("permanent-apk.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
PUBLIC_FIXTURE = b"public certificate fixture; not a private key"
PEM = b"-----BEGIN CERTIFICATE-----\n" + base64.b64encode(PUBLIC_FIXTURE) + b"\n-----END CERTIFICATE-----\n"
EXPECTED = {"alias": "salespunch360", "sha1": hashlib.sha1(PUBLIC_FIXTURE).hexdigest().upper(),
            "sha256": hashlib.sha256(PUBLIC_FIXTURE).hexdigest().upper()}


class PermanentSigningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.workspace = self.root / "workspace"
        self.workspace.mkdir()
        self.env = {"RUNNER_TEMP": self.temp.name, "GITHUB_WORKSPACE": str(self.workspace),
                    "ANDROID_SDK_ROOT": "/synthetic-sdk", "ANDROID_KEY_ALIAS": "salespunch360",
                    "ANDROID_KEYSTORE_PASSWORD": "synthetic-store-password", "ANDROID_KEY_PASSWORD": "synthetic-key-password",
                    "ANDROID_KEYSTORE_BASE64": base64.b64encode(b"\xfe\xed\xfe\xedSYNTHETIC NOT A KEY").decode()}
        self.output = io.StringIO()
        redirect = contextlib.redirect_stdout(self.output)
        redirect.__enter__()
        self.addCleanup(redirect.__exit__, None, None, None)
        self.commands = []
        self.failed = None
        self.bad_apk = False
        self.extra_signer = False
        self.expected = dict(EXPECTED)
        expected_patch = patch.object(module, "expected_certificate", side_effect=lambda: self.expected)
        expected_patch.start()
        self.addCleanup(expected_patch.stop)
        self.runner = patch.object(module, "run", side_effect=self.tool)
        self.runner.start()
        self.addCleanup(self.runner.stop)

    def tool(self, command, env):
        self.commands.append(command)
        self.assertNotIn("-genkeypair", command)
        self.assertNotIn("-genkey", command)
        self.assertNotIn(self.env["ANDROID_KEYSTORE_PASSWORD"], command)
        self.assertNotIn(self.env["ANDROID_KEY_PASSWORD"], command)
        if self.failed and self.failed in command:
            raise module.SigningError("tool failed")
        if "-exportcert" in command: return PEM
        if "-certreq" in command:
            self.assertIn("-keypass:env", command)
            return b"PUBLIC CSR"
        if command[0].endswith("zipalign") and "-f" in command:
            Path(command[-1]).write_bytes(b"ALIGNED SYNTHETIC APK")
        if command[0].endswith("apksigner") and "sign" in command:
            self.assertIn("env:ANDROID_KEYSTORE_PASSWORD", command)
            self.assertIn("env:ANDROID_KEY_PASSWORD", command)
            Path(command[command.index("--out") + 1]).write_bytes(b"SIGNED SYNTHETIC APK")
        if "verify" in command:
            sha256 = "B" * 64 if self.bad_apk else EXPECTED['sha256']
            output = f"Signer #1 certificate SHA-256 digest: {sha256}\nSigner #1 certificate SHA-1 digest: {EXPECTED['sha1']}\n"
            if self.extra_signer: output += f"Signer #2 certificate SHA-256 digest: {sha256}\n"
            return output.encode()
        return b""

    def unsigned(self):
        path = self.workspace / "android/app/build/outputs/apk/release/app-release-unsigned.apk"
        path.parent.mkdir(parents=True)
        path.write_bytes(b"SYNTHETIC UNSIGNED APK")

    def test_prepare_validates_certificate_and_private_key_password(self):
        self.assertEqual(module.prepare(self.env), EXPECTED)
        self.assertTrue((module.signing_directory(self.env) / "salespunch360.jks").is_file())
        self.assertTrue(any("-certreq" in c for c in self.commands))
        self.assertEqual((module.signing_directory(self.env).stat().st_mode & 0o777), 0o700)

    def test_missing_secret_has_no_fallback(self):
        del self.env["ANDROID_KEYSTORE_BASE64"]
        with self.assertRaises(module.SigningError): module.prepare(self.env)
        self.assertEqual(self.commands, [])
        self.assertFalse(module.signing_directory(self.env).exists())

    def test_invalid_base64_does_not_write_keystore(self):
        self.env["ANDROID_KEYSTORE_BASE64"] = "invalid!!!!"
        with self.assertRaises(module.SigningError): module.prepare(self.env)
        self.assertFalse(module.signing_directory(self.env).exists())

    def test_non_jks_is_rejected_and_removed(self):
        self.env["ANDROID_KEYSTORE_BASE64"] = base64.b64encode(b"not a keystore").decode()
        with self.assertRaises(module.SigningError): module.prepare(self.env)
        self.assertFalse(module.signing_directory(self.env).exists())

    def test_wrong_alias_blocks_before_writing(self):
        self.env["ANDROID_KEY_ALIAS"] = "other"
        with self.assertRaises(module.SigningError): module.prepare(self.env)
        self.assertFalse(module.signing_directory(self.env).exists())

    def test_wrong_store_password_removes_private_files(self):
        self.failed = "-exportcert"
        with self.assertRaises(module.SigningError): module.prepare(self.env)
        self.assertFalse(module.signing_directory(self.env).exists())

    def test_wrong_private_key_password_removes_private_files(self):
        self.failed = "-certreq"
        with self.assertRaises(module.SigningError): module.prepare(self.env)
        self.assertFalse(module.signing_directory(self.env).exists())

    def test_different_certificate_is_not_used_for_private_signing(self):
        self.expected['sha256'] = "F" * 64
        with self.assertRaises(module.SigningError): module.prepare(self.env)
        self.assertFalse(any("-certreq" in c for c in self.commands))
        self.assertFalse(module.signing_directory(self.env).exists())

    def test_existing_directory_is_not_overwritten(self):
        module.signing_directory(self.env).mkdir()
        with self.assertRaises(module.SigningError): module.prepare(self.env)
        self.assertEqual(self.commands, [])

    def test_sign_and_verify_matching_pinned_certificate(self):
        module.prepare(self.env)
        self.unsigned()
        self.assertEqual(module.sign(self.env), EXPECTED)
        self.assertTrue((self.workspace / "SalesPunch360-production-test.apk").exists())
        self.assertTrue((self.workspace / "SalesPunch360-production-test-certificate.txt").exists())
        self.assertFalse((module.signing_directory(self.env) / "aligned.apk").exists())

    def test_signing_failure_removes_output_without_fallback(self):
        module.prepare(self.env)
        self.unsigned()
        self.failed = "sign"
        with self.assertRaises(module.SigningError): module.sign(self.env)
        self.assertFalse((self.workspace / "SalesPunch360-production-test.apk").exists())
        self.assertFalse((module.signing_directory(self.env) / "aligned.apk").exists())

    def test_apk_with_wrong_certificate_is_removed(self):
        module.prepare(self.env)
        self.unsigned()
        self.bad_apk = True
        with self.assertRaises(module.SigningError): module.sign(self.env)
        self.assertFalse((self.workspace / "SalesPunch360-production-test.apk").exists())

    def test_multiple_apk_signers_are_rejected(self):
        module.prepare(self.env)
        self.unsigned()
        self.extra_signer = True
        with self.assertRaises(module.SigningError): module.sign(self.env)
        self.assertFalse((self.workspace / "SalesPunch360-production-test.apk").exists())

    def test_missing_prepared_keystore_never_signs(self):
        self.unsigned()
        with self.assertRaises(module.SigningError): module.sign(self.env)
        self.assertFalse(any("sign" in c for c in self.commands))

    def test_subprocess_failure_redacts_diagnostics_and_base64_environment(self):
        self.runner.stop()
        try:
            with patch.object(module.subprocess, "run", side_effect=subprocess.CalledProcessError(
                    1, ["keytool"], stderr=self.env["ANDROID_KEY_PASSWORD"].encode())) as tool:
                with self.assertRaises(module.SigningError) as caught: module.run(["keytool"], self.env)
                self.assertNotIn("ANDROID_KEYSTORE_BASE64", tool.call_args.kwargs['env'])
                self.assertNotIn(self.env['ANDROID_KEY_PASSWORD'], str(caught.exception))
        finally:
            self.runner.start()


class PinnedCertificateTests(unittest.TestCase):
    def test_certificate_pin_matches_successful_generation_public_metadata(self):
        value = module.expected_certificate()
        self.assertEqual(value['alias'], 'salespunch360')
        self.assertEqual(value['sha1'], '74:20:65:88:58:7E:EF:EF:05:85:98:D8:4F:86:E5:DB:2F:05:AA:46')
        self.assertEqual(value['sha256'], '69:EB:04:B6:F9:5E:95:F5:49:4A:74:9B:2C:A0:17:75:18:B8:46:45:3D:B2:D0:90:28:4A:A8:24:2D:75:EE:D6')
        self.assertTrue(value['generation_run'].endswith('/46139556845'))


if __name__ == '__main__':
    unittest.main()
