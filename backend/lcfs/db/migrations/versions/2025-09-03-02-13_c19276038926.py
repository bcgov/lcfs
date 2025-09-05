"""Migrate FSE data into charging site tables

Revision ID: c19276038926
Revises: 4dd09be7a359
Create Date: 2025-09-03 02:13:20.335182

This script populates all tables in the correct order:
1. charging_site - Extract unique sites from FSE locations
2. charging_equipment - Copy FSE records with same IDs
3. charging_site_intended_user_association - Map site intended users
4. charging_equipment_intended_use_association - Copy existing associations
5. compliance_report_charging_equipment - Create compliance associations
"""

import hashlib
import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c19276038926"
down_revision = "4dd09be7a359"
branch_labels = None
depends_on = None


def generate_site_code(
    street_address, city, postal_code, organization_id, collision_count=0, length=12
):
    """Generate a deterministic unique site code using SHA-256."""
    # Normalize inputs
    normalized_address = (
        str(street_address).upper().replace(" ", "").replace(".", "").replace(",", "")
    )
    normalized_city = str(city).upper().replace(" ", "")
    normalized_postal = str(postal_code).upper().replace(" ", "").replace("-", "")
    normalized_org_id = str(organization_id)

    # Create consistent input string
    input_string = f"{normalized_org_id}#{normalized_address}#{normalized_city}#{normalized_postal}#{collision_count}"

    # Generate SHA-256 hash
    sha256_hash = hashlib.sha256(input_string.encode()).hexdigest()

    # Return truncated hash (length configurable)
    return sha256_hash[:length]


def get_unique_site_code(
    street_address, city, postal_code, organization_id, existing_codes
):
    """Generate a unique site code using multiple deterministic approaches."""
    collision_count = organization_id
    site_code = generate_site_code(
        street_address,
        city,
        postal_code,
        organization_id,
        collision_count,
        length=5,
    )

    # Try each hash source until we find a unique code
    while site_code in existing_codes:
        collision_count = organization_id + 1
        site_code = generate_site_code(
            street_address,
            city,
            postal_code,
            organization_id,
            collision_count,
            length=5,
        )
        if site_code not in existing_codes:
            return site_code

    return site_code


def upgrade() -> None:
    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)

    try:
        # Add or alter columns as needed
        op.add_column('charging_equipment', sa.Column('organization_name', sa.Text(), nullable=True, comment="External organization name."))
        op.execute(
            "ALTER TABLE charging_equipment ALTER COLUMN equipment_number TYPE VARCHAR(5);"
        )
        op.execute(
            "ALTER TABLE charging_equipment ALTER COLUMN notes TYPE VARCHAR(1000);"
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
        op.execute(
            "ALTER TABLE compliance_report_charging_equipment ALTER COLUMN compliance_notes TYPE VARCHAR(1000);"
        )
        print("Starting comprehensive FSE to charging infrastructure migration...")

        # Get 'Draft' status
        site_status_result = session.execute(
            sa.text(
                "SELECT charging_site_status_id FROM charging_site_status WHERE status = 'Draft' LIMIT 1"
            )
        ).scalar()
        default_site_status_id = site_status_result or 1

        equipment_status_result = session.execute(
            sa.text(
                "SELECT charging_equipment_status_id FROM charging_equipment_status WHERE status = 'Draft' LIMIT 1"
            )
        ).scalar()
        default_equipment_status_id = equipment_status_result or 1

        current_time = datetime.now(timezone.utc)

        # STEP 1: Create charging sites
        print("Step 1: Creating charging sites...")

        existing_codes_result = session.execute(
            sa.text("SELECT site_code FROM charging_site")
        )
        existing_codes = {row[0] for row in existing_codes_result.fetchall()}

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

            site_code = get_unique_site_code(
                street_address, city, postal_code, organization_id, existing_codes
            )
            existing_codes.add(site_code)

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
                    "status_id": default_site_status_id,
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

        # STEP 2: Copy FSE records to charging_equipment
        print("Step 2: Creating charging equipment...")
        equipment_result = session.execute(
            sa.text(
                """
            INSERT INTO charging_equipment (
                charging_equipment_id, charging_site_id, status_id, equipment_number,
                serial_number, manufacturer, model, level_of_equipment_id, ports, notes, organization_name,
                group_uuid, version, action_type, create_date, update_date, create_user, update_user
            )
            SELECT 
                fse.final_supply_equipment_id, cs.charging_site_id, :default_status_id,
                LPAD(ROW_NUMBER() OVER (PARTITION BY cs.charging_site_id ORDER BY fse.final_supply_equipment_id)::text, 5, '0'),
                fse.serial_nbr, fse.manufacturer, fse.model, fse.level_of_equipment_id, fse.ports,
                CONCAT('Migrated from FSE ID: ', fse.final_supply_equipment_id,
                    CASE WHEN fse.registration_nbr IS NOT NULL THEN ' | Registration: ' || fse.registration_nbr ELSE '' END,
                    CASE WHEN fse.organization_name IS NOT NULL THEN ' | Org name: ' || fse.organization_name ELSE '' END,
                    CASE WHEN fse.notes IS NOT NULL THEN ' | Original notes: ' || fse.notes ELSE '' END),
                fse.organization_name,
                gen_random_uuid(), 0, 'CREATE',
                COALESCE(fse.create_date, NOW()), COALESCE(fse.update_date, NOW()),
                COALESCE(fse.create_user, 'system_migration'),
                COALESCE(fse.update_user, 'system_migration')
            FROM final_supply_equipment fse
            JOIN compliance_report cr ON fse.compliance_report_id = cr.compliance_report_id
            JOIN charging_site cs ON (cs.organization_id = cr.organization_id AND cs.street_address = fse.street_address 
                AND cs.city = fse.city AND cs.postal_code = fse.postal_code AND cs.create_user = 'system_migration')
            WHERE fse.serial_nbr IS NOT NULL AND fse.manufacturer IS NOT NULL
        """
            ),
            {"default_status_id": default_equipment_status_id},
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
            WHERE ce.notes LIKE 'Migrated from FSE ID:%'
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
            AND ce.notes LIKE 'Migrated from FSE ID:%'
        """
            )
        )
        compliance_rows = compliance_result.rowcount
        print(f"Created {compliance_rows} compliance report associations")

        print(f"\n=== Migration Summary ===")
        print(f"Charging sites: {charging_sites_inserted}")
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
        "DELETE FROM charging_equipment_intended_use_association WHERE charging_equipment_id IN (SELECT charging_equipment_id FROM charging_equipment WHERE notes LIKE 'Migrated from FSE ID:%')"
    )
    op.execute(
        "DELETE FROM charging_site_intended_user_association WHERE charging_site_id IN (SELECT charging_site_id FROM charging_site WHERE create_user = 'system_migration')"
    )
    op.execute(
        "DELETE FROM charging_equipment WHERE notes LIKE 'Migrated from FSE ID:%'"
    )
    op.execute("DELETE FROM charging_site WHERE create_user = 'system_migration'")
    op.drop_column('charging_equipment', 'organization_name')
    print("Downgrade completed - all migrated data removed")
