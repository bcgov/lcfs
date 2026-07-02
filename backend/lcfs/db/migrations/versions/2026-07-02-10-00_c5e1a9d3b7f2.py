"""LNG End-use new UCI values effective May 6, 2026 (#4571)

Adds a second, "after May 6, 2026" set of LNG marine End-use options with the
new UCI values. Because UCI is unique per (compliance_period, fuel_type,
end_use_type) and end-use options are driven by period-scoped
energy_effectiveness_ratio rows, the after-values are attached to NEW
end_use_type rows so that:

  - reporting year <= 2025 : existing ("before") options + values only
  - reporting year  = 2026 : both the existing options AND the new options
  - reporting year >= 2027 : new ("after") options + values only

The new labels are the existing ("before") label text VERBATIM plus the
" (after May 6, 2026)" suffix (derived in SQL, never truncated). Existing
end_use_type rows/labels are left untouched. EER is unchanged: the after rows
copy the same ratio as their matching before end use.

Revision ID: c5e1a9d3b7f2
Revises: f2c8a9d1b3e5
Create Date: 2026-07-02 10:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "c5e1a9d3b7f2"
down_revision = "f2c8a9d1b3e5"
branch_labels = None
depends_on = None

LNG_FUEL_TYPE_ID = 7
UCI_UOM_ID = 5
SUFFIX = " (after May 6, 2026)"
# compliance_period_id: 2024=15, 2025=16, 2026=17, 2027=18, 2028=19, 2029=20, 2030=21
BEFORE_2026_PERIOD = 17
AFTER_PERIODS = (17, 18, 19, 20, 21)  # 2026 .. 2030
# existing LNG marine "before" end_use_type ids
BEFORE_IDS = (15, 16, 17, 18, 19, 20, 21, 22, 23)

# before_end_use_type_id -> new UCI value (from the May 6, 2026 rule change)
AFTER_UCI = {
    15: 22.2,  # Marine, general
    16: 12.7,  # Marine, operated within 51 to 75% of load range
    17: 7.1,   # Marine, operated within 76 to 100% of load range
    18: 5.5,   # slip reduction kit- General
    19: 3.3,   # slip reduction kit- Operated within 26 to 75% of load range
    20: 2.9,   # slip reduction kit- Operated within 76 to 100% of load range
    21: 22.2,  # Marine, unknown whether kit installed / average load
    22: 22.2,  # Unknown engine type
    23: 0,     # Other (i.e. road transportation)
}

_BEFORE_IDS_SQL = ",".join(str(i) for i in BEFORE_IDS)
_PERIODS_SQL = ",".join(f"({p})" for p in AFTER_PERIODS)


def upgrade() -> None:
    # 1) New end_use_type rows = existing "before" label + suffix (verbatim).
    op.execute(
        f"""
        INSERT INTO end_use_type (end_use_type_id, "type", intended_use)
        SELECT
            (SELECT COALESCE(MAX(end_use_type_id), 0) FROM end_use_type)
                + row_number() OVER (ORDER BY e.end_use_type_id),
            e."type" || '{SUFFIX}',
            FALSE
        FROM end_use_type e
        WHERE e.end_use_type_id IN ({_BEFORE_IDS_SQL})
          AND NOT EXISTS (
              SELECT 1 FROM end_use_type x
              WHERE x."type" = e."type" || '{SUFFIX}'
          );
        """
    )

    # 2) EER for the after rows = same ratio as the matching before end use (2026),
    #    seeded for 2026-2030 so the options appear in those years' dropdowns.
    op.execute(
        f"""
        INSERT INTO energy_effectiveness_ratio
            (fuel_category_id, fuel_type_id, end_use_type_id, compliance_period_id,
             ratio, create_user, update_user, effective_status)
        SELECT
            before_eer.fuel_category_id,
            {LNG_FUEL_TYPE_ID},
            after_eut.end_use_type_id,
            cp.compliance_period_id,
            before_eer.ratio,
            'migration_4571', 'migration_4571', TRUE
        FROM energy_effectiveness_ratio before_eer
        JOIN end_use_type before_eut
            ON before_eut.end_use_type_id = before_eer.end_use_type_id
        JOIN end_use_type after_eut
            ON after_eut."type" = before_eut."type" || '{SUFFIX}'
        CROSS JOIN (VALUES {_PERIODS_SQL}) AS cp(compliance_period_id)
        WHERE before_eer.fuel_type_id = {LNG_FUEL_TYPE_ID}
          AND before_eer.compliance_period_id = {BEFORE_2026_PERIOD}
          AND before_eer.end_use_type_id IN ({_BEFORE_IDS_SQL})
          AND NOT EXISTS (
              SELECT 1 FROM energy_effectiveness_ratio x
              WHERE x.end_use_type_id = after_eut.end_use_type_id
                AND x.fuel_type_id = {LNG_FUEL_TYPE_ID}
                AND x.compliance_period_id = cp.compliance_period_id
          );
        """
    )

    # 3) UCI (additional_carbon_intensity) for the after rows, 2026-2030.
    uci_values = ",\n            ".join(
        f"({before_id}, {uci})" for before_id, uci in AFTER_UCI.items()
    )
    op.execute(
        f"""
        INSERT INTO additional_carbon_intensity
            (fuel_type_id, end_use_type_id, uom_id, intensity,
             create_user, update_user, compliance_period_id)
        SELECT
            {LNG_FUEL_TYPE_ID},
            after_eut.end_use_type_id,
            {UCI_UOM_ID},
            m.uci,
            'migration_4571', 'migration_4571',
            cp.compliance_period_id
        FROM (VALUES
            {uci_values}
        ) AS m(before_id, uci)
        JOIN end_use_type before_eut ON before_eut.end_use_type_id = m.before_id
        JOIN end_use_type after_eut
            ON after_eut."type" = before_eut."type" || '{SUFFIX}'
        CROSS JOIN (VALUES {_PERIODS_SQL}) AS cp(compliance_period_id)
        WHERE NOT EXISTS (
            SELECT 1 FROM additional_carbon_intensity x
            WHERE x.end_use_type_id = after_eut.end_use_type_id
              AND x.fuel_type_id = {LNG_FUEL_TYPE_ID}
              AND x.compliance_period_id = cp.compliance_period_id
        );
        """
    )

    # 4) Remove the stray, incomplete LNG rows for 2027-2030 (EER-only, no UCI)
    #    left over from the "extend to 2030" migration, so those years show only
    #    the after set.
    op.execute(
        f"""
        DELETE FROM energy_effectiveness_ratio
        WHERE fuel_type_id = {LNG_FUEL_TYPE_ID}
          AND compliance_period_id BETWEEN 18 AND 21
          AND end_use_type_id IN (
              SELECT end_use_type_id FROM end_use_type
              WHERE "type" IN ('Compression-ignition engine', 'Unknown engine type')
          );
        """
    )


def downgrade() -> None:
    # After-rows are exactly the before labels (ids 15-23) + suffix.
    after_labels_subq = f"""
        SELECT b."type" || '{SUFFIX}' FROM end_use_type b
        WHERE b.end_use_type_id IN ({_BEFORE_IDS_SQL})
    """

    op.execute(
        f"""
        DELETE FROM additional_carbon_intensity
        WHERE end_use_type_id IN (
            SELECT end_use_type_id FROM end_use_type
            WHERE "type" IN ({after_labels_subq})
        );
        """
    )
    op.execute(
        f"""
        DELETE FROM energy_effectiveness_ratio
        WHERE end_use_type_id IN (
            SELECT end_use_type_id FROM end_use_type
            WHERE "type" IN ({after_labels_subq})
        );
        """
    )
    op.execute(
        f"""
        DELETE FROM end_use_type WHERE "type" IN ({after_labels_subq});
        """
    )

    # Restore the stray extend-to-2030 LNG EER rows for 2027-2030.
    op.execute(
        f"""
        INSERT INTO energy_effectiveness_ratio
            (fuel_category_id, fuel_type_id, end_use_type_id, compliance_period_id,
             ratio, create_user, update_user, effective_status)
        SELECT
            fc.fuel_category_id,
            {LNG_FUEL_TYPE_ID},
            eut.end_use_type_id,
            cp.compliance_period_id,
            CASE eut."type"
                WHEN 'Compression-ignition engine' THEN 1.0
                WHEN 'Unknown engine type' THEN 0.9
            END,
            'migration_extend_2030', 'migration_extend_2030', TRUE
        FROM end_use_type eut
        JOIN fuel_category fc ON fc.category = 'Diesel'
        CROSS JOIN (VALUES (18),(19),(20),(21)) AS cp(compliance_period_id)
        WHERE eut."type" IN ('Compression-ignition engine', 'Unknown engine type')
          AND NOT EXISTS (
              SELECT 1 FROM energy_effectiveness_ratio x
              WHERE x.fuel_type_id = {LNG_FUEL_TYPE_ID}
                AND x.end_use_type_id = eut.end_use_type_id
                AND x.compliance_period_id = cp.compliance_period_id
          );
        """
    )
