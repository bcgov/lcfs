"""Migrate FSE data into charging site tables

Revision ID: c19276038926
Revises: 4dd09be7a359
Create Date: 2025-09-03 02:13:20.335182

This script populates all tables in the correct order with proper status mapping:
1. charging_site - Extract unique sites from FSE locations (initially Draft)
2. charging_equipment - Copy FSE records with status mapped from compliance report:
   - Draft compliance report → Draft charging equipment
   - Submitted/Recommended_by_analyst/Recommended_by_manager → Submitted
   - Assessed → Validated
3. charging_site_intended_user_association - Map site intended users
4. charging_equipment_intended_use_association - Copy existing associations
5. compliance_report_charging_equipment - Create compliance associations
6. Update charging_site status based on equipment status (highest status wins)
"""

import uuid
from datetime import datetime, timezone
from lcfs.utils.unique_key_generators import next_base36
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c19276038926"
down_revision = "4dd09be7a359"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)

    try:
        # Check if migration has already been run by looking for actual migration artifacts
        # Check for charging sites created by this migration or equipment with FSE ID notes
        existing_sites = session.execute(
            sa.text(
                """
                SELECT COUNT(*) FROM charging_site
                WHERE create_user = 'system_migration'
                """
            )
        ).scalar()

        existing_equipment = session.execute(
            sa.text(
                """
                SELECT COUNT(*) FROM charging_equipment
                WHERE notes LIKE 'FSE ID:%'
                """
            )
        ).scalar()

        if (existing_sites and existing_sites > 0) or (existing_equipment and existing_equipment > 0):
            print(f"Migration already completed - found {existing_sites} migrated sites and {existing_equipment} migrated equipment records. Skipping data migration.")
            session.commit()
            return

        # Add or alter columns as needed
        from sqlalchemy import inspect as sa_inspect
        inspector = sa_inspect(bind)
        columns = [col['name'] for col in inspector.get_columns('charging_equipment')]

        if 'organization_name' not in columns:
            op.add_column(
                "charging_equipment",
                sa.Column(
                    "organization_name",
                    sa.String(500),
                    nullable=True,
                    comment="allocating organization name.",
                ),
            )
        op.execute(
            "ALTER TABLE charging_equipment ALTER COLUMN equipment_number TYPE VARCHAR(5);"
        )
        op.execute(
            "ALTER TABLE charging_equipment ALTER COLUMN manufacturer TYPE VARCHAR(500);"
        )
        op.execute(
            "ALTER TABLE charging_equipment ALTER COLUMN serial_number TYPE VARCHAR(500);"
        )
        op.execute(
            "ALTER TABLE charging_equipment ALTER COLUMN model TYPE VARCHAR(500);"
        )
        print("Starting comprehensive FSE to charging infrastructure migration...")

        # Get status IDs for mapping compliance report status to charging statuses
        # Status mapping:
        # - Draft compliance report -> Draft charging status (1)
        # - Submitted/Recommended_by_analyst/Recommended_by_manager -> Submitted (2)
        # - Assessed -> Validated (3)
        status_map = {
            'draft': session.execute(
                sa.text("SELECT charging_equipment_status_id FROM charging_equipment_status WHERE status = 'Draft' LIMIT 1")
            ).scalar() or 1,
            'submitted': session.execute(
                sa.text("SELECT charging_equipment_status_id FROM charging_equipment_status WHERE status = 'Submitted' LIMIT 1")
            ).scalar() or 2,
            'validated': session.execute(
                sa.text("SELECT charging_equipment_status_id FROM charging_equipment_status WHERE status = 'Validated' LIMIT 1")
            ).scalar() or 3,
        }

        current_time = datetime.now(timezone.utc)

        # STEP 1: Create charging sites (initially as Draft, will be updated based on equipment)
        print("Step 1: Creating charging sites...")
        # Get the current max site_code to continue sequence
        site_code = session.execute(
            sa.text("SELECT max(site_code) FROM charging_site limit 1")
        ).scalar()

        site_locations_result = session.execute(
            sa.text(
                """
            SELECT DISTINCT
                cr.organization_id, fse.street_address, fse.city, fse.postal_code,
                AVG(fse.latitude) as avg_latitude, AVG(fse.longitude) as avg_longitude,
                STRING_AGG(DISTINCT fse.notes, '; ') as combined_notes, COUNT(*) as equipment_count
            FROM final_supply_equipment fse
            JOIN compliance_report cr ON fse.compliance_report_id = cr.compliance_report_id
            WHERE fse.street_address IS NOT NULL AND fse.street_address != ''
            AND fse.city IS NOT NULL AND fse.city != ''
            AND fse.postal_code IS NOT NULL AND fse.postal_code != ''
            GROUP BY cr.organization_id, fse.street_address, fse.city, fse.postal_code
            ORDER BY cr.organization_id, fse.street_address
        """
            )
        )

        site_locations = site_locations_result.fetchall()
        charging_sites_inserted = 0

        for location in site_locations:
            organization_id, street_address, city, postal_code = location[:4]
            avg_latitude, avg_longitude, combined_notes, equipment_count = location[4:]

            site_code = next_base36(site_code, width=5)

            site_name = street_address
            notes = f"Extracted from {equipment_count} FSE records.; "
            if combined_notes:
                notes += f" Original notes: {combined_notes}"

            session.execute(
                sa.text(
                    """
                INSERT INTO charging_site (
                    organization_id, status_id, site_code, site_name, street_address, city, postal_code,
                    latitude, longitude, notes, group_uuid, version, action_type,
                    create_date, update_date, create_user, update_user
                ) VALUES (
                    :organization_id, :status_id, :site_code, :site_name, :street_address, :city, :postal_code,
                    :latitude, :longitude, :notes, :group_uuid, :version, :action_type,
                    :create_date, :update_date, :create_user, :update_user
                )
            """
                ),
                {
                    "organization_id": organization_id,
                    "status_id": status_map['draft'],  # Initially Draft, will be updated based on equipment status
                    "site_code": site_code,
                    "site_name": site_name,
                    "street_address": street_address,
                    "city": city,
                    "postal_code": postal_code,
                    "latitude": avg_latitude,
                    "longitude": avg_longitude,
                    "notes": notes,
                    "group_uuid": str(uuid.uuid4()),
                    "version": 0,
                    "action_type": "CREATE",
                    "create_date": current_time,
                    "update_date": current_time,
                    "create_user": "system_migration",
                    "update_user": "system_migration",
                },
            )
            charging_sites_inserted += 1

        print(f"Created {charging_sites_inserted} charging sites")

        # STEP 2: Copy FSE records to charging_equipment with status mapping from compliance report
        print("Step 2: Creating charging equipment with status based on compliance report...")
        equipment_result = session.execute(
            sa.text(
                """
            INSERT INTO charging_equipment (
                charging_equipment_id, charging_site_id, status_id, equipment_number,
                serial_number, manufacturer, model, level_of_equipment_id, ports, notes, organization_name,
                group_uuid, version, action_type, create_date, update_date, create_user, update_user
            )
            SELECT
                fse.final_supply_equipment_id,
                cs.charging_site_id,
                -- Map compliance report status to charging equipment status
                CASE
                    WHEN crs.status = 'Assessed' THEN CAST(:validated_status_id AS INTEGER)
                    WHEN crs.status IN ('Submitted', 'Recommended_by_analyst', 'Recommended_by_manager') THEN CAST(:submitted_status_id AS INTEGER)
                    ELSE CAST(:draft_status_id AS INTEGER)
                END,
                LPAD(ROW_NUMBER() OVER (PARTITION BY cs.charging_site_id ORDER BY fse.final_supply_equipment_id)::text, 5, '0'),
                fse.serial_nbr, fse.manufacturer, fse.model, fse.level_of_equipment_id, fse.ports,
                CONCAT('FSE ID: ', fse.final_supply_equipment_id,
                    CASE WHEN fse.registration_nbr IS NOT NULL THEN ' | Registration: ' || fse.registration_nbr ELSE '' END,
                    CASE WHEN fse.notes IS NOT NULL THEN ' | Original notes: ' || fse.notes ELSE '' END),
                fse.organization_name,
                gen_random_uuid(), 0, 'CREATE',
                COALESCE(fse.create_date, NOW()), COALESCE(fse.update_date, NOW()),
                COALESCE(fse.create_user, 'system_migration'),
                COALESCE(fse.update_user, 'system_migration')
            FROM final_supply_equipment fse
            JOIN (
                SELECT
                    compliance_report_id,
                    organization_id,
                    compliance_period_id
                FROM compliance_report cr1
                WHERE version = (
                    SELECT MAX(version)
                    FROM compliance_report cr2
                    WHERE cr2.organization_id = cr1.organization_id
                    AND cr2.compliance_period_id = cr1.compliance_period_id
                )
            ) latest_cr ON fse.compliance_report_id = latest_cr.compliance_report_id
            JOIN compliance_report cr ON fse.compliance_report_id = cr.compliance_report_id
            JOIN compliance_report_status crs ON cr.current_status_id = crs.compliance_report_status_id
            JOIN charging_site cs ON (cs.organization_id = cr.organization_id
                AND cs.street_address = fse.street_address
                AND cs.city = fse.city
                AND cs.postal_code = fse.postal_code
                AND cs.create_user = 'system_migration')
            WHERE fse.serial_nbr IS NOT NULL AND fse.manufacturer IS NOT null;
            """
            ),
            {
                "draft_status_id": status_map['draft'],
                "submitted_status_id": status_map['submitted'],
                "validated_status_id": status_map['validated'],
            },
        )

        equipment_rows = equipment_result.rowcount
        print(f"Created {equipment_rows} charging equipment records")

        # STEP 3: Create charging_site_intended_user_association
        print("Step 3: Creating charging site intended user associations...")
        site_user_result = session.execute(
            sa.text(
                """
            INSERT INTO charging_site_intended_user_association (charging_site_id, end_user_type_id)
            SELECT DISTINCT cs.charging_site_id, fsiua.end_user_type_id
            FROM final_supply_equipment fse
            JOIN compliance_report cr ON fse.compliance_report_id = cr.compliance_report_id
            JOIN charging_site cs ON (cs.organization_id = cr.organization_id AND cs.street_address = fse.street_address
                AND cs.city = fse.city AND cs.postal_code = fse.postal_code AND cs.create_user = 'system_migration')
            JOIN final_supply_intended_user_association fsiua ON fse.final_supply_equipment_id = fsiua.final_supply_equipment_id
            ON CONFLICT (charging_site_id, end_user_type_id) DO NOTHING
        """
            )
        )
        site_user_rows = site_user_result.rowcount
        print(f"Created {site_user_rows} charging site intended user associations")

        # STEP 4: Copy charging equipment intended use associations
        print("Step 4: Copying charging equipment intended use associations...")
        equipment_use_result = session.execute(
            sa.text(
                """
            INSERT INTO charging_equipment_intended_use_association (charging_equipment_id, end_use_type_id)
            SELECT DISTINCT
                ce.charging_equipment_id,
                fsiua.end_use_type_id
            FROM charging_equipment ce
            JOIN charging_site cs ON ce.charging_site_id = cs.charging_site_id
            JOIN final_supply_equipment fse ON (
                -- Logical join through FSE data to find original equipment
                fse.serial_nbr = ce.serial_number
                AND fse.manufacturer = ce.manufacturer
                AND COALESCE(fse.model, '') = COALESCE(ce.model, '')
            )
            JOIN compliance_report cr ON fse.compliance_report_id = cr.compliance_report_id
            JOIN final_supply_intended_use_association fsiua ON fse.final_supply_equipment_id = fsiua.final_supply_equipment_id
            WHERE ce.notes LIKE 'FSE ID:%'
            AND cs.create_user = 'system_migration'
            AND cs.organization_id = cr.organization_id
            AND cs.street_address = fse.street_address
            AND cs.city = fse.city 
            AND cs.postal_code = fse.postal_code
            ON CONFLICT (charging_equipment_id, end_use_type_id) DO NOTHING
        """
            )
        )
        equipment_use_rows = equipment_use_result.rowcount
        print(
            f"Created {equipment_use_rows} charging equipment intended use associations"
        )

        # STEP 5: Create compliance_report_charging_equipment associations
        print("Step 5: Creating compliance report charging equipment associations...")
        compliance_result = session.execute(
            sa.text(
                """
            INSERT INTO compliance_report_charging_equipment (
                charging_equipment_id, compliance_report_id, organization_id,
                date_of_supply_from, date_of_supply_to, kwh_usage, compliance_notes,
                create_date, update_date, create_user, update_user
            )
            SELECT 
                fse.final_supply_equipment_id, fse.compliance_report_id, cr.organization_id,
                fse.supply_from_date::timestamp, fse.supply_to_date::timestamp, fse.kwh_usage,
                CONCAT('Migrated from FSE compliance association',
                    CASE WHEN fse.registration_nbr IS NOT NULL THEN ' | Original registration: ' || fse.registration_nbr ELSE '' END,
                    CASE WHEN fse.notes IS NOT NULL THEN ' | Original notes: ' || fse.notes ELSE '' END),
                COALESCE(fse.create_date, NOW()), COALESCE(fse.update_date, NOW()),
                COALESCE(fse.create_user, 'system_migration'),
                COALESCE(fse.update_user, 'system_migration')
            FROM final_supply_equipment fse
            JOIN compliance_report cr ON fse.compliance_report_id = cr.compliance_report_id
            JOIN charging_equipment ce ON fse.final_supply_equipment_id = ce.charging_equipment_id
            WHERE fse.supply_from_date IS NOT NULL AND fse.supply_to_date IS NOT NULL
            AND ce.notes LIKE 'FSE ID:%'
        """
            )
        )
        compliance_rows = compliance_result.rowcount
        print(f"Created {compliance_rows} compliance report associations")

        # STEP 6: Update charging site statuses based on equipment statuses
        print("Step 6: Updating charging site statuses based on equipment...")
        site_status_update = session.execute(
            sa.text(
                """
            UPDATE charging_site cs
            SET
                status_id = CASE
                    -- If any equipment at this site is Validated, the site is Validated
                    WHEN EXISTS (
                        SELECT 1 FROM charging_equipment ce2
                        WHERE ce2.charging_site_id = cs.charging_site_id
                        AND ce2.status_id = CAST(:validated_status_id AS INTEGER)
                    ) THEN CAST(:validated_status_id AS INTEGER)
                    -- If any equipment is Submitted (and none Validated), site is Submitted
                    WHEN EXISTS (
                        SELECT 1 FROM charging_equipment ce2
                        WHERE ce2.charging_site_id = cs.charging_site_id
                        AND ce2.status_id = CAST(:submitted_status_id AS INTEGER)
                    ) THEN CAST(:submitted_status_id AS INTEGER)
                    -- Otherwise, Draft
                    ELSE CAST(:draft_status_id AS INTEGER)
                END,
                update_date = NOW(),
                update_user = 'system_migration'
            WHERE cs.create_user = 'system_migration'
            AND EXISTS (
                SELECT 1 FROM charging_equipment ce
                WHERE ce.charging_site_id = cs.charging_site_id
            )
            """
            ),
            {
                "draft_status_id": status_map['draft'],
                "submitted_status_id": status_map['submitted'],
                "validated_status_id": status_map['validated'],
            },
        )
        sites_updated = site_status_update.rowcount
        print(f"Updated {sites_updated} charging site statuses")

        print(f"\n=== Migration Summary ===")
        print(f"Charging sites created: {charging_sites_inserted}")
        print(f"Charging sites updated with correct status: {sites_updated}")
        print(f"Charging equipment: {equipment_rows}")
        print(f"Site user associations: {site_user_rows}")
        print(f"Equipment use associations: {equipment_use_rows}")
        print(f"Compliance associations: {compliance_rows}")

        session.commit()
        print("Migration completed successfully!")

    except Exception as e:
        session.rollback()
        print(f"Error during migration: {str(e)}")
        raise
    finally:
        session.close()


def downgrade() -> None:
    """Remove all migrated charging infrastructure data."""
    op.execute(
        "DELETE FROM compliance_report_charging_equipment WHERE compliance_notes LIKE 'Migrated from FSE compliance association%'"
    )
    op.execute(
        "DELETE FROM charging_equipment_intended_use_association WHERE charging_equipment_id IN (SELECT charging_equipment_id FROM charging_equipment WHERE notes LIKE 'FSE ID:%')"
    )
    op.execute(
        "DELETE FROM charging_site_intended_user_association WHERE charging_site_id IN (SELECT charging_site_id FROM charging_site WHERE create_user = 'system_migration')"
    )
    op.execute(
        "DELETE FROM charging_equipment WHERE notes LIKE 'FSE ID:%'"
    )
    op.execute("DELETE FROM charging_site WHERE create_user = 'system_migration'")
    op.drop_column("charging_equipment", "organization_name")
    print("Downgrade completed - all migrated data removed")
