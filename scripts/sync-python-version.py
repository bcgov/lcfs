#!/usr/bin/env python3
"""Keep literal Python declarations aligned with backend/.python-version."""

import argparse
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]


def synchronize(root: Path, write: bool = False) -> int:
    version = (root / "backend/.python-version").read_text().strip()
    if not re.fullmatch(r"3\.[0-9]+", version):
        print("backend/.python-version must contain a major.minor version (3.x).")
        return 1

    constraint = f"^{version}"
    declarations = {
        "backend/Dockerfile": (
            r"(?m)^FROM python:[^ ]+ as base$",
            f"FROM python:{version}-slim-trixie as base",
        ),
        "backend/Dockerfile.openshift": (
            r"(?m)^FROM artifacts\.developer\.gov\.bc\.ca/docker-remote/python:[^ ]+ as base$",
            f"FROM artifacts.developer.gov.bc.ca/docker-remote/python:{version}-slim-trixie as base",
        ),
        "backend/pyproject.toml": (
            r'(?m)^python = "[^"]+"$',
            f'python = "{constraint}"',
        ),
    }
    errors = []
    if (root / ".python-version").resolve() != (
        root / "backend/.python-version"
    ).resolve():
        errors.append(".python-version: must link to backend/.python-version")
    for name, (pattern, replacement) in declarations.items():
        path = root / name
        source = path.read_text()
        updated, count = re.subn(pattern, lambda _: replacement, source)
        if count != 1:
            errors.append(f"{name}: expected exactly one Python declaration")
        elif updated != source:
            if write:
                path.write_text(updated)
                print(f"Updated {name}")
            else:
                errors.append(f"{name}: out of sync")

    # Poetry owns lockfile resolution and the content hash; never edit it here.
    lock = (root / "backend/poetry.lock").read_text().split("[metadata]\n")[-1]
    if f'python-versions = "{constraint}"' not in lock:
        message = "backend/poetry.lock: run poetry lock with the selected Poetry 2.x release in backend"
        if write:
            print(message)
        else:
            errors.append(message)

    for error in errors:
        print(error, file=sys.stderr)
    if errors:
        print(
            "Run python3 scripts/sync-python-version.py --write after changing backend/.python-version.",
            file=sys.stderr,
        )
        return 1
    print(f"Python declarations match {version}.")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--write", action="store_true", help="update generated declarations"
    )
    sys.exit(synchronize(ROOT, parser.parse_args().write))
