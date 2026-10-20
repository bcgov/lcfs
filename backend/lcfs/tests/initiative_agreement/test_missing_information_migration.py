"""Focused data-mapping coverage for the Missing information migration."""

import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, text

MIGRATION_PATH = (
    Path(__file__).parents[2]
    / "db"
    / "migrations"
    / "versions"
    / "2026-10-19-10-00_4f2a9c8d6e1b.py"
)
SPEC = importlib.util.spec_from_file_location(
    "move_missing_information_to_eoc", MIGRATION_PATH
)
MIGRATION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIGRATION)


def _requirement(requirement_id, *, active=True, outcome=None):
    return {
        "evidence_requirement_id": requirement_id,
        "is_active": active,
        "review_outcome": outcome,
    }


def test_migration_maps_to_the_only_active_eoc():
    requirements = [
        _requirement(1, active=False),
        _requirement(2),
    ]

    assert MIGRATION._resolve_requirement_id(requirements) == 2


def test_migration_does_not_infer_ownership_from_review_outcomes():
    requirements = [
        _requirement(1, outcome="Satisfactory"),
        _requirement(2, outcome="Information requested"),
        _requirement(3, active=False, outcome="Information requested"),
    ]

    with pytest.raises(ValueError, match="No unique active evidence requirement"):
        MIGRATION._resolve_requirement_id(requirements)


@pytest.mark.parametrize(
    "requirements",
    [
        [],
        [_requirement(1, active=False)],
        [_requirement(1), _requirement(2)],
        [
            _requirement(1, outcome="Information requested"),
            _requirement(2, outcome="Information requested"),
        ],
    ],
)
def test_migration_refuses_zero_or_ambiguous_active_eoc_mappings(requirements):
    with pytest.raises(ValueError, match="No unique active evidence requirement"):
        MIGRATION._resolve_requirement_id(requirements)


@pytest.mark.parametrize("legacy_value", ["Single EOC", "   ", None])
def test_migration_round_trip_preserves_values_and_parent_links(
    legacy_value,
):
    second_value = "Second action EOC" if legacy_value is not None else None
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
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
                "requirement_number INTEGER NOT NULL, "
                "is_active BOOLEAN NOT NULL, "
                "review_outcome TEXT)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO designated_action VALUES "
                "(1, :legacy_value), (2, :second_value), (3, NULL)"
            ),
            {"legacy_value": legacy_value, "second_value": second_value},
        )
        connection.execute(
            text(
                "INSERT INTO evidence_requirement VALUES "
                "(101, 1, 1, 1, NULL), "
                "(201, 2, 1, 0, 'Satisfactory'), "
                "(202, 2, 2, 1, 'Information requested')"
            )
        )

        with Operations.context(MigrationContext.configure(connection)):
            MIGRATION.upgrade()

        values = connection.execute(
            text(
                "SELECT evidence_requirement_id, designated_action_id, "
                "missing_information "
                "FROM evidence_requirement ORDER BY evidence_requirement_id"
            )
        ).all()
        action_columns = connection.execute(
            text("PRAGMA table_info(designated_action)")
        ).all()
        with Operations.context(MigrationContext.configure(connection)):
            MIGRATION.downgrade()
        restored_values = connection.execute(
            text(
                "SELECT designated_action_id, missing_information "
                "FROM designated_action ORDER BY designated_action_id"
            )
        ).all()

    assert values == [
        (101, 1, legacy_value),
        (201, 2, None),
        (202, 2, second_value),
    ]
    assert "missing_information" not in {column[1] for column in action_columns}
    assert restored_values == [
        (1, legacy_value),
        (2, second_value),
        (3, None),
    ]
    engine.dispose()


@pytest.mark.parametrize("eoc_count", [0, 2])
def test_upgrade_keeps_legacy_value_when_no_eoc_can_be_selected(eoc_count):
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
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
                "requirement_number INTEGER NOT NULL, "
                "is_active BOOLEAN NOT NULL, "
                "review_outcome TEXT)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO designated_action VALUES "
                "(0, 'Mapped legacy text'), (1, 'Unmapped legacy text')"
            )
        )
        connection.execute(
            text("INSERT INTO evidence_requirement VALUES (101, 0, 1, 1, NULL)")
        )
        for requirement_id in range(1, eoc_count + 1):
            connection.execute(
                text(
                    "INSERT INTO evidence_requirement VALUES "
                    "(:requirement_id, 1, :requirement_id, 1, NULL)"
                ),
                {"requirement_id": requirement_id},
            )

        with Operations.context(MigrationContext.configure(connection)):
            with pytest.raises(RuntimeError, match="Cannot safely map"):
                MIGRATION.upgrade()

        legacy_value = connection.execute(
            text(
                "SELECT missing_information FROM designated_action "
                "WHERE designated_action_id = 1"
            )
        ).scalar_one()
        requirement_columns = connection.execute(
            text("PRAGMA table_info(evidence_requirement)")
        ).all()

    assert legacy_value == "Unmapped legacy text"
    assert "missing_information" not in {column[1] for column in requirement_columns}
    engine.dispose()


@pytest.mark.parametrize("second_value", ["Another request", "   "])
def test_downgrade_preserves_multiple_eoc_values(second_value):
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE evidence_requirement "
                "(designated_action_id INTEGER, missing_information TEXT)"
            )
        )
        connection.execute(
            text("INSERT INTO evidence_requirement VALUES (1, :value)"),
            [{"value": "First request"}, {"value": second_value}],
        )
        with Operations.context(MigrationContext.configure(connection)):
            with pytest.raises(RuntimeError, match="multiple EOCs have values"):
                MIGRATION.downgrade()

        values = (
            connection.execute(
                text("SELECT missing_information FROM evidence_requirement")
            )
            .scalars()
            .all()
        )

    assert values == ["First request", second_value]
    engine.dispose()
