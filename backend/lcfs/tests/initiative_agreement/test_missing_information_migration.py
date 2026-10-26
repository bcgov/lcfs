"""Coverage for the merged EOC backfill and legacy-column retirement."""

import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text

MIGRATIONS = Path(__file__).parents[2] / "db" / "migrations" / "versions"


def _load_migration(filename, name):
    spec = importlib.util.spec_from_file_location(name, MIGRATIONS / filename)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    return migration


BACKFILL = _load_migration(
    "2026-10-16-09-00_5f7a5242e0c1.py", "backfill_missing_information_per_eoc"
)
RETIRE = _load_migration(
    "2026-10-19-10-00_4f2a9c8d6e1b.py", "retire_da_missing_information"
)


def _database(legacy_value, eocs):
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.connection.driver_connection.create_function(
            "BTRIM", 1, lambda value: value.strip() if value else value
        )
        connection.execute(
            text(
                "CREATE TABLE designated_action ("
                "designated_action_id INTEGER PRIMARY KEY, "
                "missing_information TEXT)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE evidence_requirement ("
                "evidence_requirement_id INTEGER PRIMARY KEY, "
                "designated_action_id INTEGER NOT NULL, "
                "requirement_number INTEGER NOT NULL, title TEXT, "
                "description TEXT NOT NULL, is_active BOOLEAN NOT NULL)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO designated_action "
                "(designated_action_id, missing_information) VALUES (1, :value)"
            ),
            {"value": legacy_value},
        )
        if eocs:
            connection.execute(
                text(
                    "INSERT INTO evidence_requirement "
                    "(evidence_requirement_id, designated_action_id, "
                    "requirement_number, title, description, is_active) "
                    "VALUES (:id, 1, :number, :title, :description, :active)"
                ),
                [
                    {
                        "id": requirement_id,
                        "number": number,
                        "title": title,
                        "description": description,
                        "active": active,
                    }
                    for requirement_id, number, title, description, active in eocs
                ],
            )
    return engine


def _run(connection, migration, direction="upgrade"):
    with Operations.context(MigrationContext.configure(connection)):
        getattr(migration, direction)()


def _column_names(connection, table):
    return {
        column[1] for column in connection.execute(text(f"PRAGMA table_info({table})"))
    }


@pytest.mark.parametrize(
    ("legacy_value", "eocs", "expected_values", "blocked"),
    [
        ("Original request", [], None, True),
        ("   ", [], [], False),
        (
            "Original request",
            [(101, 1, "Permits", "Permit", True)],
            ["Original request"],
            False,
        ),
        (
            "Original request",
            [
                (101, 1, "Permits", "Permit", True),
                (102, 2, "Risk register", "Risk register", True),
                (103, 3, "Inactive", "Inactive", False),
            ],
            ["Original request", "Original request", None],
            False,
        ),
    ],
)
def test_backfill_and_retirement_preserve_values_and_parent_links(
    legacy_value, eocs, expected_values, blocked
):
    engine = _database(legacy_value, eocs)
    with engine.begin() as connection:
        _run(connection, BACKFILL)

    with engine.begin() as connection:
        if blocked:
            with pytest.raises(RuntimeError, match="legacy values remain unmapped"):
                _run(connection, RETIRE)
            assert (
                connection.execute(
                    text("SELECT missing_information FROM designated_action")
                ).scalar_one()
                == legacy_value
            )
            assert "missing_information" in _column_names(
                connection, "designated_action"
            )
        else:
            _run(connection, RETIRE)
            rows = connection.execute(
                text(
                    "SELECT designated_action_id, missing_information "
                    "FROM evidence_requirement ORDER BY evidence_requirement_id"
                )
            ).all()
            assert "missing_information" not in _column_names(
                connection, "designated_action"
            )
            assert [row[0] for row in rows] == [1] * len(expected_values)
            assert [row[1] for row in rows] == expected_values
    engine.dispose()


def test_downgrade_restores_identical_eoc_values_without_data_loss():
    engine = _database(
        None,
        [
            (101, 1, "Permits", "Permit", True),
            (102, 2, "Risk register", "Risk register", True),
        ],
    )
    with engine.begin() as connection:
        _run(connection, BACKFILL)
        connection.execute(
            text(
                "UPDATE evidence_requirement SET missing_information = "
                "'Same request' WHERE designated_action_id = 1"
            )
        )
        _run(connection, RETIRE)
        _run(connection, RETIRE, "downgrade")
        assert (
            connection.execute(
                text("SELECT missing_information FROM designated_action")
            ).scalar_one()
            == "Same request"
        )
    engine.dispose()


def test_downgrade_refuses_to_choose_between_distinct_eoc_values():
    engine = _database(
        None,
        [
            (101, 1, "Permits", "Permit", True),
            (102, 2, "Risk register", "Risk register", True),
        ],
    )
    with engine.begin() as connection:
        _run(connection, BACKFILL)
        connection.execute(
            text(
                "UPDATE evidence_requirement SET missing_information = "
                "CASE evidence_requirement_id "
                "WHEN 101 THEN 'The signed permit.' "
                "ELSE 'The risk register.' END"
            )
        )
        _run(connection, RETIRE)
        with pytest.raises(RuntimeError, match="different EOC values exist"):
            _run(connection, RETIRE, "downgrade")
        assert "missing_information" not in _column_names(
            connection, "designated_action"
        )
        assert connection.execute(
            text(
                "SELECT missing_information FROM evidence_requirement "
                "ORDER BY evidence_requirement_id"
            )
        ).scalars().all() == ["The signed permit.", "The risk register."]
    engine.dispose()
