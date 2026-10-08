import importlib.util
from pathlib import Path
from types import SimpleNamespace


MIGRATION_PATH = (
    Path(__file__).resolve().parents[2]
    / "db"
    / "migrations"
    / "versions"
    / "2026-10-06-09-00_5148a6b7c9d0.py"
)


def _load_migration():
    spec = importlib.util.spec_from_file_location(
        "hydrogen_energy_density_unit_migration", MIGRATION_PATH
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_hydrogen_energy_density_migration_sets_mj_per_kg(monkeypatch):
    migration = _load_migration()
    executed_statements = []
    monkeypatch.setattr(migration.op, "execute", executed_statements.append)

    migration.upgrade()

    assert len(executed_statements) == 1
    statement = " ".join(str(executed_statements[0]).split())
    assert "UPDATE energy_density AS ed" in statement
    assert "ft.fuel_type = 'Hydrogen'" in statement
    assert "kg.name = 'MJ/kg'" in statement
    assert "ed.uom_id <> kg.uom_id" in statement
    assert "SET uom_id = kg.uom_id" in statement
    assert "density =" not in statement
