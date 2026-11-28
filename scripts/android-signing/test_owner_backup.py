"""No signing key generation: keytool is mocked; archive tests use synthetic bytes."""
import base64
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import py7zr

spec = importlib.util.spec_from_file_location("owner_backup", Path(__file__).with_name("generate-owner-backup.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class OwnerBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.env = {
            "GITHUB_ACTIONS": "true", "RUNNER_TEMP": self.temp.name,
            "ANDROID_KEY_ALIAS": "salespunch360", "ANDROID_KEYSTORE_PASSWORD": "s" * 32,
            "ANDROID_KEY_PASSWORD": "k" * 32, "ANDROID_KEYSTORE_EXPORT_PASSWORD": "e" * 32,
        }
        self.calls = []
        self.fail = None
        self.backup = None
        self.mock = patch.object(module, "run", side_effect=self.tool)
        self.mock.start()
        self.addCleanup(self.mock.stop)
        self.encrypt = patch.object(module, "encrypt_bundle", side_effect=self.archive)
        self.encrypt.start()
        self.addCleanup(self.encrypt.stop)
        self.which = patch.object(module.shutil, "which", return_value="/test/tool")
        self.which.start()
        self.addCleanup(self.which.stop)

    def archive(self, bundle, archive, password):
        self.calls.append(["encrypt", str(archive)])
        self.assertEqual(password, self.env["ANDROID_KEYSTORE_EXPORT_PASSWORD"])
        if archive.name == "preflight.7z":
            if self.fail == "preflight": raise module.SigningError("archive preflight rejected")
        else:
            if self.fail == "encryption": raise module.SigningError("encryption rejected")
            self.backup = {p.name: p.read_bytes() for p in bundle.iterdir()}
        archive.write_bytes(b"SYNTHETIC CIPHERTEXT, NOT A REAL KEY")

    def tool(self, command, *, data=None, env=None):
        self.calls.append(command)
        self.assertEqual(command[0], "keytool")
        self.assertNotIn("ANDROID_KEYSTORE_EXPORT_PASSWORD", env)
        self.assertIn("-storepass:env", command)
        for name in ("ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD", "ANDROID_KEYSTORE_EXPORT_PASSWORD"):
            self.assertNotIn(self.env[name], command)
        if "-genkeypair" in command:
            self.assertIn("-keypass:env", command)
            for flag, value in [("-storetype", "JKS"), ("-keyalg", "RSA"),
                                ("-keysize", "3072"), ("-validity", "10000"),
                                ("-alias", "salespunch360")]:
                self.assertEqual(command[command.index(flag) + 1], value)
            Path(command[command.index("-keystore") + 1]).write_bytes(b"SYNTHETIC NOT A REAL KEY")
            if self.fail == "keytool": raise module.SigningError("keytool rejected")
        if "-exportcert" in command:
            return b"-----BEGIN CERTIFICATE-----\ncHVibGlj\n-----END CERTIFICATE-----\n"
        return b""

    def generate(self):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            module.generate(self.env)
        return output.getvalue()

    def assert_clean_private(self):
        self.assertEqual(list(Path(self.temp.name).glob("sp360-signing-private-*")), [])

    def test_exports_ciphertext_checksum_and_public_fingerprints_only(self):
        output = self.generate()
        exported = Path(self.temp.name) / "salespunch360-signing-export"
        self.assertEqual(sorted(x.name for x in exported.iterdir()),
                         ["certificate-fingerprints.txt", "salespunch360-owner-backup.7z",
                          "salespunch360-owner-backup.7z.sha256"])
        self.assertIn("SHA-1:", output)
        self.assertIn("SHA-256:", output)
        self.assertIn("Archive SHA-256:", output)
        for name in ("ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD", "ANDROID_KEYSTORE_EXPORT_PASSWORD"):
            self.assertNotIn(self.env[name], output)
        self.assertEqual(base64.b64decode(self.backup["salespunch360.jks.base64"]), self.backup["salespunch360.jks"])
        credentials = json.loads(self.backup["signing-credentials.json"])
        for key in ["ANDROID_KEY_ALIAS", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD"]:
            self.assertEqual(credentials[key], self.env[key])
        self.assertNotIn("ANDROID_KEYSTORE_EXPORT_PASSWORD", credentials)
        self.assert_clean_private()
        self.assertEqual(self.calls[0][0], "encrypt")
        self.assertEqual(self.calls[1][0], "keytool")

    def test_complete_export_with_real_encryption_and_mocked_keytool(self):
        self.encrypt.stop()
        try:
            output = self.generate()
        finally:
            self.encrypt.start()
        destination = Path(self.temp.name) / "recovered"
        archive_path = Path(self.temp.name) / "salespunch360-signing-export" / "salespunch360-owner-backup.7z"
        with py7zr.SevenZipFile(archive_path, password=self.env["ANDROID_KEYSTORE_EXPORT_PASSWORD"]) as archive:
            archive.extractall(destination)
        self.assertEqual((destination / "salespunch360.jks").read_bytes(), b"SYNTHETIC NOT A REAL KEY")
        self.assertEqual(base64.b64decode((destination / "salespunch360.jks.base64").read_bytes()),
                         (destination / "salespunch360.jks").read_bytes())
        credentials = json.loads((destination / "signing-credentials.json").read_text())
        self.assertEqual(credentials["ANDROID_KEY_PASSWORD"], self.env["ANDROID_KEY_PASSWORD"])
        self.assertNotIn("ANDROID_KEYSTORE_EXPORT_PASSWORD", credentials)
        self.assertNotIn(self.env["ANDROID_KEYSTORE_EXPORT_PASSWORD"], output)
        self.assert_clean_private()

    def test_existing_keystore_blocks_generation(self):
        self.env["ANDROID_KEYSTORE_BASE64"] = "present"
        with self.assertRaises(module.SigningError): self.generate()
        self.assertEqual(self.calls, [])

    def test_missing_or_short_credentials_block_generation(self):
        for key in ["ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD", "ANDROID_KEY_ALIAS",
                    "ANDROID_KEYSTORE_EXPORT_PASSWORD"]:
            with self.subTest(key=key):
                original = self.env[key]
                self.env[key] = ""
                with self.assertRaises(module.SigningError): self.generate()
                self.env[key] = original
        self.assertEqual(self.calls, [])

    def test_reused_export_password_blocks_generation(self):
        for key in ["ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_PASSWORD"]:
            self.env["ANDROID_KEYSTORE_EXPORT_PASSWORD"] = self.env[key]
            with self.assertRaises(module.SigningError): self.generate()
        self.assertEqual(self.calls, [])

    def test_archive_preflight_fails_before_key_generation(self):
        self.fail = "preflight"
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

    def test_tool_error_diagnostics_never_expose_passwords(self):
        self.mock.stop()
        error = subprocess.CalledProcessError(1, ["keytool"], stderr=self.env["ANDROID_KEY_PASSWORD"].encode())
        with patch.object(module.subprocess, "run", side_effect=error):
            with self.assertRaises(module.SigningError) as caught: module.run(["keytool"])
        self.assertNotIn(self.env["ANDROID_KEY_PASSWORD"], str(caught.exception))
        self.assertIn("suppressed", str(caught.exception))
        self.mock.start()

    def test_existing_output_is_never_overwritten(self):
        (Path(self.temp.name) / "salespunch360-signing-export").mkdir()
        with self.assertRaises(module.SigningError): self.generate()
        self.assertEqual(self.calls, [])


class RealArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / "bundle"
        self.bundle.mkdir()
        (self.bundle / "salespunch360.jks").write_bytes(b"SYNTHETIC BYTES, NOT A KEY")
        (self.bundle / "salespunch360.jks.base64").write_bytes(base64.b64encode(b"SYNTHETIC BYTES, NOT A KEY"))
        self.archive = self.root / "synthetic.7z"
        self.password = "synthetic validation password, not a real secret"
        module.encrypt_bundle(self.bundle, self.archive, self.password)

    def test_aes256_header_encrypted_roundtrip(self):
        with py7zr.SevenZipFile(self.archive, password=self.password) as archive:
            self.assertTrue(archive.needs_password())
            self.assertIn("7zAES", archive.archiveinfo().method_names)
            archive.extractall(self.root / "restored")
        for entry in self.bundle.iterdir():
            self.assertEqual(entry.read_bytes(), (self.root / "restored" / entry.name).read_bytes())
        ciphertext = self.archive.read_bytes()
        self.assertNotIn(b"salespunch360.jks", ciphertext)
        self.assertNotIn(b"SYNTHETIC BYTES", ciphertext)
        self.assertNotIn(self.password.encode(), ciphertext)

    def test_missing_password_cannot_list_encrypted_names(self):
        with self.assertRaises(Exception):
            with py7zr.SevenZipFile(self.archive) as archive: archive.getnames()

    def test_wrong_password_cannot_extract(self):
        with self.assertRaises(Exception):
            with py7zr.SevenZipFile(self.archive, password="wrong password") as archive:
                archive.extractall(self.root / "wrong")

    def test_fresh_encryption_uses_new_ciphertext(self):
        second = self.root / "second.7z"
        module.encrypt_bundle(self.bundle, second, self.password)
        self.assertNotEqual(self.archive.read_bytes(), second.read_bytes())

    def test_tampered_archive_fails(self):
        data = bytearray(self.archive.read_bytes())
        data[-1] ^= 1
        self.archive.write_bytes(data)
        with self.assertRaises(Exception):
            with py7zr.SevenZipFile(self.archive, password=self.password) as archive:
                archive.extractall(self.root / "tampered")

    def test_library_error_details_are_suppressed(self):
        with patch.object(module.py7zr, "SevenZipFile", side_effect=RuntimeError(self.password)):
            with self.assertRaises(module.SigningError) as caught:
                module.encrypt_bundle(self.bundle, self.root / "failed.7z", self.password)
        self.assertNotIn(self.password, str(caught.exception))


if __name__ == "__main__":
    unittest.main()
