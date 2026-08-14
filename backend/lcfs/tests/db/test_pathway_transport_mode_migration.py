import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest


MIGRATION_PATH = (
    Path(__file__).resolve().parents[2]
    / "db"
    / "migrations"
    / "versions"
    / "2026-08-06-10-00_f9a0b1c2d3e5.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location(
        "pathway_transport_mode_migration", MIGRATION_PATH
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_pathway_transport_mode_migration_raises_for_unmatched_modes(monkeypatch):
    migration = _load_migration()
    result = SimpleNamespace(
        scalars=lambda: SimpleNamespace(all=lambda: ["Air", "Truck - old"])
    )
    bind = SimpleNamespace(execute=lambda _query: result)
    monkeypatch.setattr(migration.op, "get_bind", lambda: bind)

    with pytest.raises(RuntimeError) as exc:
        migration._raise_on_unmatched_pathway_transport_modes(
            "feedstock_transport_mode"
        )

    assert "Air, Truck - old" in str(exc.value)


def test_pathway_transport_mode_migration_allows_all_matched_modes(monkeypatch):
    migration = _load_migration()
    result = SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: []))
    bind = SimpleNamespace(execute=lambda _query: result)
    monkeypatch.setattr(migration.op, "get_bind", lambda: bind)

    migration._raise_on_unmatched_pathway_transport_modes("feedstock_transport_mode")
