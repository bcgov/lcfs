"""Rebuild the 2027-2030 energy effectiveness ratios from 2026 (#5113).

Migration 988aeb471e14 was meant to extend the EER table from 2026 to 2030
but hand-coded a list of combinations instead of copying 2026. As a result
2027-2030 had CNG / Gasoline at 1.0 instead of 0.9, and were missing every
end-use-specific Electricity, Hydrogen and LNG ratio, so those lookups found
no row and the calculation fell back to 1.0 (an EV in the Gasoline category
got 1.0 instead of 3.5). 2026 is the current regulatory schedule and it does
not change in 2027 unless regulation says so, so 2027-2030 are rebuilt as
exact copies of it.

Idempotent: it does nothing when 2027-2030 already match 2026, which is the
case in production after the equivalent data fix. Nothing references
energy_effectiveness_ratio by foreign key, so the rows are replaced outright.

Revision ID: b1c3e5a7d9f2
Revises: aee96beadb45
Create Date: 2026-09-22 10:00:00.000000
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "b1c3e5a7d9f2"
down_revision = "aee96beadb45"
branch_labels = None
depends_on = None

TARGET_PERIODS = "('2027', '2028', '2029', '2030')"


def upgrade() -> None:
    op.execute(
        f"""
        DO $$
        DECLARE
            drift integer;
        BEGIN
            -- Nothing to copy from (e.g. a partially seeded database).
            IF NOT EXISTS (
                SELECT 1
                FROM energy_effectiveness_ratio e
                JOIN compliance_period cp
                  ON cp.compliance_period_id = e.compliance_period_id
                WHERE cp.description = '2026'
            ) THEN
                RETURN;
            END IF;

            -- Rows that differ between 2027-2030 and a copy of 2026, both ways.
            WITH expected AS (
                SELECT t.compliance_period_id, s.fuel_type_id, s.fuel_category_id,
                       s.end_use_type_id, s.ratio
                FROM energy_effectiveness_ratio s
                JOIN compliance_period sp
                  ON sp.compliance_period_id = s.compliance_period_id
                 AND sp.description = '2026'
                CROSS JOIN compliance_period t
                WHERE t.description IN {TARGET_PERIODS}
            ),
            actual AS (
                SELECT e.compliance_period_id, e.fuel_type_id, e.fuel_category_id,
                       e.end_use_type_id, e.ratio
                FROM energy_effectiveness_ratio e
                JOIN compliance_period cp
                  ON cp.compliance_period_id = e.compliance_period_id
                WHERE cp.description IN {TARGET_PERIODS}
            )
            SELECT count(*) INTO drift FROM (
                (SELECT * FROM expected EXCEPT ALL SELECT * FROM actual)
                UNION ALL
                (SELECT * FROM actual EXCEPT ALL SELECT * FROM expected)
            ) d;

            IF drift = 0 THEN
                RETURN;
            END IF;

            DELETE FROM energy_effectiveness_ratio e
            USING compliance_period cp
            WHERE cp.compliance_period_id = e.compliance_period_id
              AND cp.description IN {TARGET_PERIODS};

            INSERT INTO energy_effectiveness_ratio (
                fuel_category_id, fuel_type_id, end_use_type_id, ratio,
                display_order, effective_date, effective_status, expiration_date,
                compliance_period_id, create_user, update_user
            )
            SELECT s.fuel_category_id, s.fuel_type_id, s.end_use_type_id, s.ratio,
                   s.display_order, s.effective_date, s.effective_status,
                   s.expiration_date, t.compliance_period_id,
                   'migration_5113_eer_2027_2030', 'migration_5113_eer_2027_2030'
            FROM energy_effectiveness_ratio s
            JOIN compliance_period sp
              ON sp.compliance_period_id = s.compliance_period_id
             AND sp.description = '2026'
            CROSS JOIN compliance_period t
            WHERE t.description IN {TARGET_PERIODS};
        END $$;
        """
    )


def downgrade() -> None:
    # Data correction: the previous 2027-2030 rows were wrong, and restoring
    # them would reintroduce the miscalculation. Intentionally not reversed.
    pass
