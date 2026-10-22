"""Exercise version changes and drift detection without modifying the repository."""

import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "sync-python-version.py"
SPEC = importlib.util.spec_from_file_location("sync_python_version", SCRIPT)
SYNC = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SYNC)


class PythonVersionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        for name in (
            "backend/.python-version",
            "backend/Dockerfile",
            "backend/Dockerfile.openshift",
            "backend/pyproject.toml",
            "backend/poetry.lock",
        ):
            destination = self.root / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text((SCRIPT.parents[1] / name).read_text())
        (self.root / ".python-version").symlink_to("backend/.python-version")
        etl = self.root / "etl/python_migration"
        etl.mkdir(parents=True)
        (etl / ".python-version").write_text("3.11.10\n")

    def run_sync(self, write=False):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(
            io.StringIO()
        ):
            return SYNC.synchronize(self.root, write)

    def test_current_declarations_match(self):
        self.assertEqual(self.run_sync(), 0)

    def test_version_change_updates_consumers_and_requires_relock(self):
        version_file = self.root / "backend/.python-version"
        major, minor = map(int, version_file.read_text().strip().split("."))
        version = f"{major}.{minor + 1}"
        constraint = f">={version},<{major}.{minor + 2}"
        version_file.write_text(f"{version}\n")
        original = (self.root / "backend/Dockerfile").read_text()
        self.assertEqual(self.run_sync(), 1)
        self.assertEqual((self.root / "backend/Dockerfile").read_text(), original)
        self.assertEqual(self.run_sync(write=True), 0)
        self.assertIn(
            f"python:{version}-slim-bookworm",
            (self.root / "backend/Dockerfile").read_text(),
        )
        self.assertIn(
            f"python:{version}-bookworm",
            (self.root / "backend/Dockerfile.openshift").read_text(),
        )
        self.assertIn(
            f'python = "{constraint}"',
            (self.root / "backend/pyproject.toml").read_text(),
        )
        self.assertEqual(
            self.run_sync(), 1
        )  # Lockfile still targets the previous version.
        self.assertEqual((self.root / ".python-version").read_text(), f"{version}\n")
        self.assertEqual(
            (self.root / "etl/python_migration/.python-version").read_text(),
            "3.11.10\n",
        )

    def test_patch_pin_is_rejected(self):
        (self.root / "backend/.python-version").write_text("3.11.10\n")
        self.assertEqual(self.run_sync(write=True), 1)

    def test_missing_declaration_is_rejected(self):
        (self.root / "backend/Dockerfile").write_text("FROM scratch\n")
        self.assertEqual(self.run_sync(write=True), 1)

    def test_standalone_etl_version_file_is_not_managed(self):
        path = self.root / "etl/python_migration/.python-version"
        path.write_text("3.11.10\n")
        self.assertEqual(self.run_sync(), 0)
        self.assertEqual(path.read_text(), "3.11.10\n")
