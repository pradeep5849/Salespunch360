#!/usr/bin/env python3
"""Independent 7-Zip extraction of synthetic files only; never runs keytool."""
import base64
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile

spec = importlib.util.spec_from_file_location("owner_backup", Path(__file__).with_name("generate-owner-backup.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    bundle = root / "synthetic"
    bundle.mkdir()
    data = b"SYNTHETIC INTEROPERABILITY FIXTURE; NOT A SIGNING KEY"
    (bundle / "salespunch360.jks").write_bytes(data)
    (bundle / "salespunch360.jks.base64").write_bytes(base64.b64encode(data))
    archive = root / "synthetic.7z"
    # This is a public test fixture, never a repository secret or production password.
    fixture_password = "public-synthetic-fixture-for-interoperability-test"
    module.encrypt_bundle(bundle, archive, fixture_password)
    destination = root / "extracted"
    result = subprocess.run([os.environ["SEVENZIP_BIN"], "x", str(archive),
                             "-p" + fixture_password, "-o" + str(destination), "-y"],
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise SystemExit("Independent 7-Zip extraction failed.")
    for entry in bundle.iterdir():
        if entry.read_bytes() != (destination / entry.name).read_bytes():
            raise SystemExit("Independent 7-Zip extraction changed synthetic data.")
    wrong = subprocess.run([os.environ["SEVENZIP_BIN"], "t", str(archive), "-pwrong-fixture-password"],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if wrong.returncode == 0:
        raise SystemExit("Independent extractor accepted an incorrect password.")
print("Official 7-Zip extracted both synthetic files byte-for-byte and rejected the wrong password. No signing key generated.")
