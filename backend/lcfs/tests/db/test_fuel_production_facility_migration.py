import importlib.util
import re
from pathlib import Path

import pytest
from sqlalchemy import text


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("code_organization", "application_organization", "expected_facility"),
    [(1, 1, 77), (2, 1, None), (None, 1, None)],
)
async def test_associated_code_backfill_requires_matching_ownership(
    dbsession,
    monkeypatch,
    code_organization,
    application_organization,
    expected_facility,
):
    path = (
        Path(__file__).resolve().parents[2]
        / "db"
        / "migrations"
        / "versions"
        / "2026-11-05-11-00_9e0e5741b48f.py"
    )
    spec = importlib.util.spec_from_file_location("facility_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    statements = []
    for operation in (
        "create_table",
        "create_index",
        "add_column",
        "create_foreign_key",
        "drop_column",
    ):
        monkeypatch.setattr(migration.op, operation, lambda *args, **kwargs: None)
    monkeypatch.setattr(migration.op, "execute", statements.append)
    monkeypatch.setattr(migration, "_insert_missing_facilities", lambda *args: None)
    monkeypatch.setattr(migration, "_link_facilities", lambda *args: None)
    migration.upgrade()
    backfill = next(sql for sql in statements if "UPDATE fuel_code AS code" in sql)
    for source, target in (
        ("ci_application_fuel_code_association", "test_facility_assoc"),
        ("ci_application", "test_facility_application"),
        ("fuel_code", "test_facility_code"),
    ):
        backfill = re.sub(rf"\b{source}\b", target, backfill)

    await dbsession.execute(text("""
        CREATE TEMP TABLE test_facility_code ON COMMIT DROP AS
        SELECT fuel_code_id, organization_id, fuel_production_facility_id,
               fuel_production_facility_city, fuel_production_facility_province_state,
               fuel_production_facility_country, facility_nameplate_capacity,
               facility_nameplate_capacity_unit, contact_name, contact_email
        FROM fuel_code WHERE false
    """))
    await dbsession.execute(text("""
        CREATE TEMP TABLE test_facility_application ON COMMIT DROP AS
        SELECT ci_application_id, organization_id, fuel_production_facility_id,
               facility_city, facility_province_state, facility_country,
               facility_nameplate_capacity, facility_nameplate_capacity_unit
        FROM ci_application WHERE false
    """))
    await dbsession.execute(text("""
        CREATE TEMP TABLE test_facility_assoc (
            ci_application_id integer, fuel_code_id integer
        ) ON COMMIT DROP
    """))
    await dbsession.execute(
        text("""
            INSERT INTO test_facility_code (fuel_code_id, organization_id,
                fuel_production_facility_city, contact_name)
            VALUES (1, :organization_id, 'Example City', 'Example Contact')
        """),
        {"organization_id": code_organization},
    )
    await dbsession.execute(
        text("""
            INSERT INTO test_facility_application (ci_application_id, organization_id,
                fuel_production_facility_id, facility_city)
            VALUES (1, :organization_id, 77, 'Example City')
        """),
        {"organization_id": application_organization},
    )
    await dbsession.execute(text("INSERT INTO test_facility_assoc VALUES (1, 1)"))

    await dbsession.execute(text(backfill))

    assigned_facility = await dbsession.scalar(
        text("SELECT fuel_production_facility_id FROM test_facility_code")
    )
    assert assigned_facility == expected_facility
