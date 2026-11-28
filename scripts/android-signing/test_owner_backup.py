"""Boundary tests only: keytool/GnuPG are mocked; no private key is generated."""
import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("owner_backup", Path(__file__).with_name("generate-owner-backup.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
FINGERPRINT = "A" * 40


class OwnerBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.env = {
            "GITHUB_ACTIONS": "true", "RUNNER_TEMP": self.temp.name,
            "ANDROID_KEY_ALIAS": "salespunch360", "ANDROID_KEYSTORE_PASSWORD": "s" * 32,
            "ANDROID_KEY_PASSWORD": "k" * 32,
            "RECIPIENT_FINGERPRINT": FINGERPRINT,
            "RECIPIENT_PUBLIC_KEY_BASE64": base64.b64encode(b"synthetic public key").decode(),
        }
        self.calls = []
        self.listed = f"pub:-:3072:1:ID:0:0:::::e:\nfpr:::::::::{FINGERPRINT}:\n"
        self.fail = None
        self.backup = None
        self.mock = patch.object(module, "run", side_effect=self.tool)
        self.mock.start()
        self.addCleanup(self.mock.stop)
        self.which = patch.object(module.shutil, "which", return_value="/test/tool")
        self.which.start()
        self.addCleanup(self.which.stop)

    def tool(self, command, *, data=None, env=None):
        self.calls.append(command)
        if command[0] == "gpg":
            self.assertFalse(any(k.startswith("ANDROID_") for k in env))
            self.assertIn("--no-options", command)
            if "show-only" in command:
                return self.listed.encode()
            if "--encrypt" in command:
                if data is not None and self.fail == "recipient":
                    raise module.SigningError("recipient rejected")
                if "--output" in command:
                    if self.fail == "encryption":
                        raise module.SigningError("encryption rejected")
                    archive = Path(command[-1])
                    with tarfile.open(archive) as tar:
                        self.backup = {name: tar.extractfile(name).read() for name in tar.getnames()}
                    Path(command[command.index("--output") + 1]).write_bytes(b"ENCRYPTED SYNTHETIC OUTPUT")
        if command[0] == "keytool":
            self.assertIn("-storepass:env", command)
            self.assertNotIn(self.env["ANDROID_KEYSTORE_PASSWORD"], command)
            if "-genkeypair" in command:
                self.assertIn("-keypass:env", command)
                self.assertEqual(command[command.index("-storetype") + 1], "JKS")
                self.assertEqual(command[command.index("-keyalg") + 1], "RSA")
                self.assertEqual(command[command.index("-keysize") + 1], "3072")
                self.assertEqual(command[command.index("-validity") + 1], "10000")
                Path(command[command.index("-keystore") + 1]).write_bytes(b"SYNTHETIC NOT A REAL KEY")
                if self.fail == "keytool":
                    raise module.SigningError("keytool rejected")
            if "-exportcert" in command:
                return b"-----BEGIN CERTIFICATE-----\ncHVibGlj\n-----END CERTIFICATE-----\n"
        return b""

    def generate(self):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            module.generate(self.env)
        return output.getvalue()

    def assert_clean_private(self):
        self.assertEqual(list(Path(self.temp.name).glob("sp360-signing-private-*")), [])

    def test_exports_only_encrypted_backup_and_public_fingerprints(self):
        output = self.generate()
        exported = Path(self.temp.name) / "salespunch360-signing-export"
        self.assertEqual(sorted(x.name for x in exported.iterdir()),
                         ["certificate-fingerprints.txt", "salespunch360-owner-backup.tar.gz.gpg"])
        self.assertIn("SHA-1:", output)
        self.assertIn("SHA-256:", output)
        self.assertNotIn(self.env["ANDROID_KEYSTORE_PASSWORD"], output)
        self.assertNotIn(self.env["ANDROID_KEY_PASSWORD"], output)
        self.assertEqual(base64.b64decode(self.backup["salespunch360.jks.base64"]), self.backup["salespunch360.jks"])
        credentials = json.loads(self.backup["signing-credentials.json"])
        for key in ["ANDROID_KEY_ALIAS", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD"]:
            self.assertEqual(credentials[key], self.env[key])
        self.assert_clean_private()
        probe_index = next(i for i, c in enumerate(self.calls) if "--encrypt" in c)
        generation_index = next(i for i, c in enumerate(self.calls) if "-genkeypair" in c)
        self.assertLess(probe_index, generation_index)

    def test_existing_keystore_blocks_generation(self):
        self.env["ANDROID_KEYSTORE_BASE64"] = "present"
        with self.assertRaises(module.SigningError): self.generate()
        self.assertEqual(self.calls, [])

    def test_missing_or_short_credentials_block_generation(self):
        for key in ["ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD", "ANDROID_KEY_ALIAS"]:
            with self.subTest(key=key):
                original = self.env[key]
                self.env[key] = ""
                with self.assertRaises(module.SigningError): self.generate()
                self.env[key] = original
        self.assertEqual(self.calls, [])

    def test_wrong_fingerprint_blocks_generation(self):
        self.listed = self.listed.replace(FINGERPRINT, "B" * 40)
        with self.assertRaises(module.SigningError): self.generate()
        self.assertFalse(any(c[0] == "keytool" for c in self.calls))
        self.assert_clean_private()

    def test_private_recipient_material_is_rejected(self):
        self.listed = self.listed.replace("pub:", "sec:")
        with self.assertRaises(module.SigningError): self.generate()
        self.assertFalse(any(c[0] == "keytool" for c in self.calls))

    def test_multiple_recipients_are_rejected(self):
        self.listed += self.listed
        with self.assertRaises(module.SigningError): self.generate()
        self.assertFalse(any(c[0] == "keytool" for c in self.calls))

    def test_non_encrypting_recipient_fails_before_generation(self):
        self.fail = "recipient"
        with self.assertRaises(module.SigningError): self.generate()
        self.assertFalse(any(c[0] == "keytool" for c in self.calls))
        self.assert_clean_private()

    def test_keytool_failure_cleans_private_files(self):
        self.fail = "keytool"
        with self.assertRaises(module.SigningError): self.generate()
        self.assert_clean_private()
        self.assertFalse((Path(self.temp.name) / "salespunch360-signing-export").exists())

    def test_export_encryption_failure_leaves_no_artifact(self):
        self.fail = "encryption"
        with self.assertRaises(module.SigningError): self.generate()
        self.assert_clean_private()
        self.assertFalse((Path(self.temp.name) / "salespunch360-signing-export").exists())

    def test_non_actions_execution_is_rejected(self):
        self.env["GITHUB_ACTIONS"] = "false"
        with self.assertRaises(module.SigningError): self.generate()
        self.assertEqual(self.calls, [])

    def test_invalid_recipient_encoding_is_rejected(self):
        self.env["RECIPIENT_PUBLIC_KEY_BASE64"] = "invalid!!!!"
        with self.assertRaises(module.SigningError): self.generate()
        self.assertEqual(self.calls, [])

    def test_tool_error_diagnostics_never_expose_passwords(self):
        self.mock.stop()
        error = subprocess.CalledProcessError(1, ["keytool"], stderr=self.env["ANDROID_KEY_PASSWORD"].encode())
        with patch.object(module.subprocess, "run", side_effect=error):
            with self.assertRaises(module.SigningError) as caught:
                module.run(["keytool"])
        self.assertNotIn(self.env["ANDROID_KEY_PASSWORD"], str(caught.exception))
        self.assertIn("suppressed", str(caught.exception))
        self.mock.start()

    def test_existing_output_is_never_overwritten(self):
        (Path(self.temp.name) / "salespunch360-signing-export").mkdir()
        with self.assertRaises(module.SigningError): self.generate()
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
