"""
Consolidated Migration: Squashed data updates from historical migrations

Combines multiple migration files into one, preserving the chronological order
of their 'upgrade' steps and reversing it for 'downgrade'. Comments mark the
original revision IDs.

Revision ID: ec826b9226df
Revises: f217cd32474b
Create Date: 2025-01-20 14:40:01.289718
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM
from datetime import datetime

# Single consolidated revision identifier
revision = "ec826b9226df"
down_revision = "f217cd32474b"
branch_labels = None
depends_on = None


def upgrade():
    """
    Consolidated UPGRADE logic from all migrations, in ascending date order:
    (1) 043c52082a3b        (2024-11-27)
    (2) aeaa26f5cdd5        (2024-12-02)
    (3) 9206124a098b        (2024-12-04)
    (4) 8491890dd688        (2024-12-04)
    (5) d4104af84f2b        (2024-12-05)
    (6) 26ab15f8ab18        (2024-12-06)
    (7) 7ae38a8413ab        (2024-12-09)
    (8) 5d729face5ab        (2024-12-12)
    (9) 851e09cf8661        (2024-12-17)
    (10) 59873cafbcd8       (2024-12-20)
    (11) 5fbcb508c1be       (2024-12-21)
    (12) ab04810d4d7c        (2024-12-22)
    (13) d9cdd9fca0ce        (2024-12-24)
    (14) bfa7bbb1eea3        (2025-01-03)
    (15) e883ad1f0f60        (2025-01-03)
    (16) 94306eca5261        (2025-01-06)
    (17) fa98709e7952        (2025-01-06)
    (18) 998929392c8b        (2025-01-07)
    (19) fe03799b4018        (2025-01-14)
    (20) 5bc0ef48739a        (2025-01-15)
    """

    #
    # (1) 043c52082a3b (2024-11-27): Add 'Marine-domestic' and 'Marine-international' transport modes
    #
    current_time = datetime.now()
    # Update Marine -> Marine-domestic
    op.execute(
        f"""
        UPDATE transport_mode
        SET transport_mode = 'Marine-domestic',
            update_date = '{current_time}',
            update_user = 'no-user'
        WHERE transport_mode = 'Marine'
    """
    )

    # Insert Marine-international
    op.execute(
        f"""
        INSERT INTO transport_mode (transport_mode, create_date, update_date, create_user, update_user)
        VALUES ('Marine-international', '{current_time}', '{current_time}', 'no_user', 'no_user')
    """
    )

    #
    # (2) aeaa26f5cdd5 (2024-12-02): Replace "Other" in level_of_equipment with long description
    #
    op.execute(
        """
        UPDATE level_of_equipment
        SET name = 'Other - Additional information provided in notes field'
        WHERE name = 'Other'
    """
    )

    #
    # (4) 8491890dd688 (2024-12-04): Data fixes for FuelType and AllocationTransactionType
    #                                (Originally used Python model references; replaced with raw SQL.)
    #
    #   - fuel_type_id = 6 -> units=Kilograms
    #   - fuel_type_id = 20 -> fossil_derived=False
    #   - allocation_transaction_type_id = 2 -> "Allocated to"
    #   - allocation_transaction_type_id = 1 -> "Allocated from"
    #
    op.execute(
        """
        UPDATE fuel_type
        SET units = 'Kilograms'
        WHERE fuel_type_id = 6
    """
    )
    op.execute(
        """
        UPDATE fuel_type
        SET fossil_derived = false
        WHERE fuel_type_id = 20
    """
    )
    op.execute(
        """
        UPDATE allocation_transaction_type
        SET type = 'Allocated to',
            description = 'Fuel allocated to another supplier under an allocation agreement'
        WHERE allocation_transaction_type_id = 2
    """
    )
    op.execute(
        """
        UPDATE allocation_transaction_type
        SET type = 'Allocated from',
            description = 'Fuel allocated from another supplier under an allocation agreement'
        WHERE allocation_transaction_type_id = 1
    """
    )

    #
    # (5) d4104af84f2b (2024-12-05): Update Notification Types and remove old data/enum
    #
    #   1) DELETE FROM notification_type
    #   2) Convert name column to VARCHAR from old enum
    #   3) DROP TYPE notification_type_enum_v2 if exists
    #
    op.execute("DELETE FROM notification_type;")

    with op.batch_alter_table("notification_type") as batch_op:
        batch_op.alter_column(
            "name",
            existing_type=sa.String(length=255),  # in the final script, assume string
            type_=sa.String(length=255),
            existing_nullable=False,
        )

    op.execute("DROP TYPE IF EXISTS notification_type_enum_v2;")

    #
    # (6) 26ab15f8ab18 (2024-12-06): Update end_use_type (IDs 14-21) and adjust additional_carbon_intensity, EER
    #
    current_time = datetime.now()
    updates = [
        (14, "Aircraft"),
        (15, "Compression-ignition engine- Marine, general"),
        (
            16,
            "Compression-ignition engine- Marine, operated within 51 to 75% of load range",
        ),
        (
            17,
            "Compression-ignition engine- Marine, operated within 76 to 100% of load range",
        ),
        (
            18,
            "Compression-ignition engine- Marine, with methane slip reduction kit- General",
        ),
        (
            19,
            "Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 51 to 75% of load range",
        ),
        (
            20,
            "Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 76 to 100% of load range",
        ),
        (
            21,
            "Compression-ignition engine- Marine, unknown whether kit is installed or average operating load range",
        ),
    ]
    for end_use_id, new_type in updates:
        op.execute(
            f"""
            UPDATE end_use_type
            SET type = '{new_type}',
                sub_type = NULL,
                intended_use = true,
                update_date = '{current_time}',
                update_user = 'no_user'
            WHERE end_use_type_id = {end_use_id}
        """
        )

    # Adjust additional_carbon_intensity (IDs 1-9)
    uci_updates = [
        (1, 7, 5, None, 0),
        (2, None, 5, None, 0),
        (3, 7, 5, 15, 27.3),
        (4, 7, 5, 16, 17.8),
        (5, 7, 5, 17, 12.2),
        (6, 7, 5, 18, 10.6),
        (7, 7, 5, 19, 8.4),
        (8, 7, 5, 20, 8.0),
        (9, 7, 5, 21, 27.3),
    ]
    for uci_id, fuel_type_id, uom_id, end_use_type_id, intensity in uci_updates:
        # If 'None' for end_use_type_id or fuel_type_id, set them to NULL
        if fuel_type_id and end_use_type_id:
            op.execute(
                f"""
                UPDATE additional_carbon_intensity
                SET fuel_type_id = {fuel_type_id},
                    uom_id = {uom_id},
                    end_use_type_id = {end_use_type_id},
                    intensity = {intensity},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {uci_id}
            """
            )
        elif fuel_type_id:
            op.execute(
                f"""
                UPDATE additional_carbon_intensity
                SET fuel_type_id = {fuel_type_id},
                    uom_id = {uom_id},
                    end_use_type_id = NULL,
                    intensity = {intensity},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {uci_id}
            """
            )
        else:
            op.execute(
                f"""
                UPDATE additional_carbon_intensity
                SET fuel_type_id = NULL,
                    uom_id = {uom_id},
                    end_use_type_id = NULL,
                    intensity = {intensity},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {uci_id}
            """
            )

    # Adjust EER for IDs 14-24
    eer_updates = [
        (14, 2, 3, 10, 2.8),
        (15, 2, 3, 11, 2.4),
        (16, 2, 3, 2, 1.0),
        (17, 2, 6, 3, 1.8),
        (18, 2, 6, 2, 0.9),
        (19, 2, 13, None, 0.9),
        (20, 3, 3, None, 2.5),
        (21, 3, 11, None, 1.0),
        (22, 2, 7, 15, 1.0),
        (23, 2, 7, 16, 1.0),
        (24, 2, 7, 17, 1.0),
    ]
    for eer_id, fc_id, ft_id, eut_id, ratio in eer_updates:
        if eut_id:
            op.execute(
                f"""
                UPDATE energy_effectiveness_ratio
                SET fuel_category_id = {fc_id},
                    fuel_type_id = {ft_id},
                    end_use_type_id = {eut_id},
                    ratio = {ratio},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE eer_id = {eer_id}
            """
            )
        else:
            op.execute(
                f"""
                UPDATE energy_effectiveness_ratio
                SET fuel_category_id = {fc_id},
                    fuel_type_id = {ft_id},
                    end_use_type_id = NULL,
                    ratio = {ratio},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE eer_id = {eer_id}
            """
            )

    #
    # (7) 7ae38a8413ab (2024-12-09): Mark volume-based fuel types as other_uses_fossil_derived = true, and gas-based as false
    #
    current_time = datetime.now()
    op.execute(
        f"""
        UPDATE fuel_type
        SET other_uses_fossil_derived = true,
            update_date = '{current_time}',
            update_user = 'no_user'
        WHERE fuel_type IN (
            'Alternative jet fuel',
            'Biodiesel',
            'Ethanol',
            'HDRD',
            'Renewable gasoline',
            'Renewable naphtha'
        )
    """
    )
    op.execute(
        f"""
        UPDATE fuel_type
        SET other_uses_fossil_derived = false,
            update_date = '{current_time}',
            update_user = 'no_user'
        WHERE fuel_type IN (
            'CNG',
            'Electricity',
            'Hydrogen',
            'LNG',
            'Propane'
        )
    """
    )

    #
    # (8) 5d729face5ab (2024-12-12): Update default_carbon_intensity for 'Other diesel' (fuel_type_id=20) to 100.21
    #
    op.execute(
        """
        UPDATE fuel_type
        SET default_carbon_intensity = 100.21
        WHERE fuel_type_id = 20
    """
    )

    #
    # (9) 851e09cf8661 (2024-12-17): Add "default_carbon_intensity" column to "fuel_category" and populate
    #
    op.execute(
        """
        UPDATE "fuel_category"
        SET "default_carbon_intensity" = 88.83
        WHERE "description" = 'Jet fuel';
    """
    )
    op.execute(
        """
        UPDATE "fuel_category"
        SET "default_carbon_intensity" = 100.21
        WHERE "description" = 'Diesel';
    """
    )
    op.execute(
        """
        UPDATE "fuel_category"
        SET "default_carbon_intensity" = 93.67
        WHERE "description" = 'Gasoline';
    """
    )
    op.alter_column(
        "fuel_category",
        "default_carbon_intensity",
        existing_type=sa.Numeric(precision=10, scale=2),
        nullable=False,
    )

    #
    # (10) 59873cafbcd8 (2024-12-20): Update 'Other diesel' to set fossil_derived = false, other_uses_fossil_derived = false
    #
    op.execute(
        """
        UPDATE fuel_type
        SET fossil_derived = false, other_uses_fossil_derived = false
        WHERE fuel_type = 'Other diesel'
    """
    )

    #
    # (11) 5fbcb508c1be (2024-12-21): Rename an end_use_type for LNG
    #
    op.execute(
        """
        UPDATE end_use_type
        SET type = 'Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 26 to 75% of load range'
        WHERE end_use_type_id = 19
    """
    )

    #
    # (13) d9cdd9fca0ce (2024-12-24): Move common seeders to migrations
    #
    # (Full block of reference data insertion)
    #
    dates = [(year, f"{year}-01-01", f"{year}-12-31") for year in range(2010, 2033)]
    for i, (year, start_date, end_date) in enumerate(dates, 1):
        op.execute(
            f"""
            INSERT INTO compliance_period (
                compliance_period_id, description, display_order,
                effective_date, expiration_date, effective_status
            )
            VALUES (
                {i}, '{year}', {i},
                '{start_date}', '{end_date}', TRUE
            )
            ON CONFLICT (compliance_period_id) DO NOTHING;
        """
        )

    op.execute(
        """
        INSERT INTO organization_type (organization_type_id, org_type, description)
        VALUES
            (1, 'fuel_supplier', 'Fuel Supplier'),
            (2, 'electricity_supplier', 'Electricity Supplier'),
            (3, 'broker', 'Broker'),
            (4, 'utilities', 'Utilities (local or public)')
        ON CONFLICT (organization_type_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO organization_status (organization_status_id, status, description)
        VALUES
            (1, 'Unregistered', 'Unregistered'),
            (2, 'Registered', 'Registered'),
            (3, 'Suspended', 'Suspended'),
            (4, 'Canceled', 'Canceled')
        ON CONFLICT (organization_status_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO role (role_id, name, description, is_government_role, display_order)
        VALUES
            (1, 'GOVERNMENT', 'Identifies a government user in the system.', TRUE, 1),
            (2, 'SUPPLIER', 'Identifies a supplier user in the system.', FALSE, 2),
            (3, 'ADMINISTRATOR', 'Can add/edit IDIR users and assign roles, add/edit organizations, BCeID users, and assign roles', TRUE, 3),
            (4, 'ANALYST', 'Can make recommendations on transfers, transactions, and compliance reports, manage file submissions, and add/edit fuel codes', TRUE, 4),
            (5, 'COMPLIANCE_MANAGER', 'Can make recommendations on compliance reports', TRUE, 5),
            (6, 'DIRECTOR', 'Can assess compliance reports and approve transactions', TRUE, 6),
            (7, 'MANAGE_USERS', 'Can add/edit BCeID users and assign roles', FALSE, 7),
            (8, 'TRANSFER', 'Can create/save transfers and submit files', FALSE, 8),
            (9, 'COMPLIANCE_REPORTING', 'Can create/save compliance reports and submit files', FALSE, 9),
            (10, 'SIGNING_AUTHORITY', 'Can sign and submit compliance reports to government and transfers to trade partners/government', FALSE, 10),
            (11, 'READ_ONLY', 'Can view transactions, compliance reports, and files', FALSE, 11)
        ON CONFLICT (role_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO transfer_status (transfer_status_id, status, visible_to_transferor, visible_to_transferee, visible_to_government)
        VALUES
            (1, 'Draft', TRUE, FALSE, FALSE),
            (2, 'Deleted', FALSE, FALSE, FALSE),
            (3, 'Sent', TRUE, TRUE, FALSE),
            (4, 'Submitted', TRUE, TRUE, TRUE),
            (5, 'Recommended', TRUE, TRUE, TRUE),
            (6, 'Recorded', TRUE, TRUE, TRUE),
            (7, 'Refused', TRUE, TRUE, TRUE),
            (8, 'Declined', TRUE, TRUE, FALSE),
            (9, 'Rescinded', TRUE, TRUE, TRUE)
        ON CONFLICT (transfer_status_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO transfer_category (transfer_category_id, category, effective_status)
        VALUES
            (1, 'A', TRUE),
            (2, 'B', TRUE),
            (3, 'C', TRUE),
            (4, 'D', TRUE)
        ON CONFLICT (transfer_category_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO admin_adjustment_status (admin_adjustment_status_id, status)
        VALUES
            (1, 'Draft'),
            (2, 'Recommended'),
            (3, 'Approved'),
            (4, 'Deleted')
        ON CONFLICT (admin_adjustment_status_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO initiative_agreement_status (initiative_agreement_status_id, status)
        VALUES
            (1, 'Draft'),
            (2, 'Recommended'),
            (3, 'Approved'),
            (4, 'Deleted')
        ON CONFLICT (initiative_agreement_status_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO expected_use_type (expected_use_type_id, name, description, effective_status)
        VALUES
            (1, 'Heating oil', 'Fuel used for heating purposes', TRUE),
            (2, 'Other', 'Other type of fuel description', TRUE)
        ON CONFLICT (expected_use_type_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO unit_of_measure (uom_id, name, description)
        VALUES
            (1, 'MJ/L', 'Megajoules per litre'),
            (2, 'MJ/kWh', 'Megajoules per kilowatt hour'),
            (3, 'MJ/m³', 'Megajoules per cubic metre'),
            (4, 'MJ/kg', 'Megajoules per kilogram'),
            (5, 'gCO²e/MJ', 'grams of carbon dioxide equivalent per megajoule')
        ON CONFLICT (uom_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO end_use_type (end_use_type_id, type, intended_use)
        VALUES 
            (1, 'Light duty motor vehicles', TRUE),
            (2, 'Other or unknown', FALSE),
            (3, 'Fuel cell vehicle', FALSE),
            (4, 'Battery bus', TRUE),
            (5, 'Battery truck', TRUE),
            (6, 'Cargo handling equipment', TRUE),
            (7, 'Fixed guiderail', TRUE),
            (8, 'Ground support equipment', TRUE),
            (9, 'Heavy forklift', TRUE),
            (10, 'Shore power', TRUE),
            (11, 'Trolley bus', TRUE),
            (12, 'Compression-ignition engine', FALSE),
            (13, 'Other', TRUE),
            (14, 'Aircraft', TRUE),
            (15, 'Compression-ignition engine- Marine, general', TRUE),
            (16, 'Compression-ignition engine- Marine, operated within 51 to 75% of load range', TRUE),
            (17, 'Compression-ignition engine- Marine, operated within 76 to 100% of load range', TRUE),
            (18, 'Compression-ignition engine- Marine, with methane slip reduction kit- General', TRUE),
            (19, 'Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 51 to 75% of load range', TRUE),
            (20, 'Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 76 to 100% of load range', TRUE),
            (21, 'Compression-ignition engine- Marine, unknown whether kit is installed or average operating load range', TRUE),
            (22, 'Unknown engine type', TRUE),
            (23, 'Other (i.e. road transportation)', TRUE),
            (24, 'Any', TRUE)
        ON CONFLICT (end_use_type_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO provision_of_the_act (provision_of_the_act_id, name, description, effective_status)
        VALUES
            (1, 'Prescribed carbon intensity - section 19 (a)', 'Prescribed carbon intensity - section 19 (a)', TRUE),
            (2, 'Fuel code - section 19 (b) (i)', 'Fuel code - section 19 (b) (i)', TRUE),
            (3, 'Default carbon intensity - section 19 (b) (ii)', 'Default carbon intensity - section 19 (b) (ii)', TRUE)
        ON CONFLICT (provision_of_the_act_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO fuel_category (fuel_category_id, category, description, default_carbon_intensity, effective_status)
        VALUES
            (1, 'Gasoline', 'Gasoline', 93.67, TRUE),
            (2, 'Diesel', 'Diesel', 100.21, TRUE),
            (3, 'Jet fuel', 'Jet fuel', 88.83, TRUE)
        ON CONFLICT (fuel_category_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO fuel_type (fuel_type_id, fuel_type, fossil_derived, other_uses_fossil_derived,
            provision_1_id, provision_2_id, default_carbon_intensity, units, unrecognized)
        VALUES
            (1, 'Biodiesel', FALSE, FALSE, 2, 3, 100.21, 'Litres', FALSE),
            (2, 'CNG', FALSE, TRUE, 2, 3, 63.91, 'Cubic_metres', FALSE),
            (3, 'Electricity', FALSE, TRUE, 2, 3, 12.14, 'Kilowatt_hour', FALSE),
            (4, 'Ethanol', FALSE, FALSE, 2, 3, 93.67, 'Litres', FALSE),
            (5, 'HDRD', FALSE, FALSE, 2, 3, 100.21, 'Litres', FALSE),
            (6, 'Hydrogen', FALSE, TRUE, 2, 3, 123.96, 'Kilograms', FALSE),
            (7, 'LNG', FALSE, TRUE, 2, 3, 90.11, 'Kilograms', FALSE),
            (11, 'Alternative jet fuel', FALSE, FALSE, 2, 3, 88.83, 'Litres', FALSE),
            (13, 'Propane', FALSE, TRUE, 2, 3, 79.87, 'Litres', FALSE),
            (14, 'Renewable gasoline', FALSE, FALSE, 2, 3, 93.67, 'Litres', FALSE),
            (15, 'Renewable naphtha', FALSE, FALSE, 2, 3, 93.67, 'Litres', FALSE),
            (16, 'Fossil-derived diesel', TRUE, TRUE, 1, NULL, 94.38, 'Litres', FALSE),
            (17, 'Fossil-derived gasoline', TRUE, TRUE, 1, NULL, 93.67, 'Litres', FALSE),
            (18, 'Fossil-derived jet fuel', TRUE, TRUE, 1, NULL, 88.83, 'Litres', FALSE),
            (19, 'Other', FALSE, FALSE, 2, 3, 0, 'Litres', TRUE),
            (20, 'Other diesel', FALSE, FALSE, 1, NULL, 100.21, 'Litres', FALSE)
        ON CONFLICT (fuel_type_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO energy_effectiveness_ratio (
            eer_id, fuel_category_id, fuel_type_id, end_use_type_id, ratio, effective_status
        )
        VALUES
            (1, 1, 2, 24, 0.9, TRUE),
            (2, 1, 3, 1, 3.5, TRUE),
            (3, 1, 3, 2, 1.0, TRUE),
            (4, 1, 6, 3, 2.4, TRUE),
            (5, 1, 6, 2, 0.9, TRUE),
            (6, 1, 13, 24, 0.9, TRUE),
            (7, 2, 2, 24, 0.9, TRUE),
            (8, 2, 3, 4, 3.8, TRUE),
            (9, 2, 3, 5, 3.2, TRUE),
            (10, 2, 3, 6, 2.5, TRUE),
            (11, 2, 3, 7, 2.9, TRUE),
            (12, 2, 3, 8, 2.5, TRUE),
            (13, 2, 3, 9, 3.9, TRUE),
            (14, 2, 3, 10, 2.8, TRUE),
            (15, 2, 3, 11, 2.4, TRUE),
            (16, 2, 3, 2, 1.0, TRUE),
            (17, 2, 6, 3, 1.8, TRUE),
            (18, 2, 6, 2, 0.9, TRUE),
            (19, 2, 13, 24, 0.9, TRUE),
            (20, 3, 3, 24, 2.5, TRUE),
            (21, 3, 11, 24, 1.0, TRUE),
            (22, 2, 7, 15, 1.0, TRUE),
            (23, 2, 7, 16, 1.0, TRUE),
            (24, 2, 7, 17, 1.0, TRUE),
            (25, 2, 7, 18, 1.0, TRUE),
            (26, 2, 7, 19, 1.0, TRUE),
            (27, 2, 7, 20, 1.0, TRUE),
            (28, 2, 7, 21, 1.0, TRUE),
            (29, 2, 7, 22, 0.9, TRUE),
            (30, 2, 7, 23, 0.9, TRUE),
            (31, 2, 1, 24, 1.0, TRUE),
            (32, 2, 5, 24, 1.0, TRUE),
            (33, 3, 6, 24, 1.0, TRUE),
            (34, 1, 14, 24, 1.0, TRUE),
            (35, 1, 15, 24, 1.0, TRUE),
            (36, 2, 16, 24, 1.0, TRUE),
            (37, 1, 17, 24, 1.0, TRUE),
            (38, 3, 18, 24, 1.0, TRUE),
            (39, 1, 19, 24, 1.0, TRUE),
            (40, 2, 19, 24, 1.0, TRUE),
            (41, 3, 7, 24, 1.0, TRUE),
            (42, 2, 20, 24, 1.0, TRUE),
            (43, 1, 4, 24, 1.0, TRUE)
        ON CONFLICT (eer_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO additional_carbon_intensity (additional_uci_id, fuel_type_id, uom_id, end_use_type_id, intensity)
        VALUES
            (1, 7, 5, NULL, 0),
            (2, NULL, 5, NULL, 0),
            (3, 7, 5, 15, 27.3),
            (4, 7, 5, 16, 17.8),
            (5, 7, 5, 17, 12.2),
            (6, 7, 5, 18, 10.6),
            (7, 7, 5, 19, 8.4),
            (8, 7, 5, 20, 8.0),
            (9, 7, 5, 21, 27.3),
            (10, 7, 5, 22, 27.3),
            (11, 7, 5, 23, 0)
        ON CONFLICT (additional_uci_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO energy_density (energy_density_id, fuel_type_id, uom_id, density)
        VALUES 
            (1, 17, 1, 34.69),
            (2, 4, 1, 23.58),
            (3, 14, 1, 34.69),
            (4, 15, 1, 34.51),
            (5, 16, 1, 38.65),
            (6, 1, 1, 35.40),
            (7, 5, 1, 37.89),
            (9, 18, 1, 37.40),
            (10, 11, 1, 36.00),
            (11, 3, 2, 3.60),
            (12, 6, 2, 141.76),
            (13, 13, 1, 25.62),
            (14, 2, 3, 38.27),
            (15, 7, 4, 53.54),
            (16, 20, 1, 36.51)
        ON CONFLICT (energy_density_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO target_carbon_intensity (
            target_carbon_intensity_id, 
            compliance_period_id, 
            fuel_category_id, 
            target_carbon_intensity, 
            reduction_target_percentage,
            effective_status
        )
        VALUES 
            (1, 15, 1, 78.68, 16.0, TRUE),
            (2, 16, 1, 76.53, 18.3, TRUE),
            (3, 17, 1, 74.37, 20.6, TRUE),
            (4, 18, 1, 72.13, 23.0, TRUE),
            (5, 19, 1, 69.97, 25.3, TRUE),
            (6, 20, 1, 67.72, 27.7, TRUE),
            (7, 21, 1, 65.57, 30.0, TRUE),
            (8, 15, 2, 79.28, 16.0, TRUE),
            (9, 16, 2, 77.11, 18.3, TRUE),
            (10, 17, 2, 74.94, 20.6, TRUE),
            (11, 18, 2, 72.67, 23.0, TRUE),
            (12, 19, 2, 70.50, 25.3, TRUE),
            (13, 20, 2, 68.24, 27.7, TRUE),
            (14, 21, 2, 66.07, 30.0, TRUE),
            (15, 15, 3, 88.83, 0.0, TRUE),
            (16, 16, 3, 88.83, 0.0, TRUE),
            (17, 17, 3, 87.05, 2.0, TRUE),
            (18, 18, 3, 85.28, 4.0, TRUE),
            (19, 19, 3, 83.50, 6.0, TRUE),
            (20, 20, 3, 81.72, 8.0, TRUE),
            (21, 21, 3, 79.95, 10.0, TRUE)
        ON CONFLICT (target_carbon_intensity_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO fuel_instance (fuel_instance_id, fuel_type_id, fuel_category_id)
        VALUES 
            (1, 1, 2),
            (2, 2, 1),
            (3, 2, 2),
            (4, 3, 1),
            (5, 3, 2),
            (6, 3, 3),
            (7, 4, 1),
            (8, 5, 2),
            (9, 6, 1),
            (10, 6, 2),
            (11, 6, 3),
            (12, 7, 2),
            (16, 11, 3),
            (18, 13, 1),
            (19, 13, 2),
            (20, 14, 1),
            (21, 15, 1),
            (22, 16, 2),
            (23, 17, 1),
            (24, 18, 3),
            (25, 19, 1),
            (26, 19, 2),
            (27, 19, 3),
            (28, 20, 2)
        ON CONFLICT (fuel_instance_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO transport_mode (transport_mode_id, transport_mode)
        VALUES
            (1, 'Truck'),
            (2, 'Rail'),
            (3, 'Marine-domestic'),
            (4, 'Adjacent'),
            (5, 'Pipeline')
        ON CONFLICT (transport_mode_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO fuel_code_prefix (fuel_code_prefix_id, prefix)
        VALUES
            (1, 'BCLCF'),
            (2, 'PROXY')
        ON CONFLICT (fuel_code_prefix_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO fuel_code_status (fuel_code_status_id, status, description, display_order)
        VALUES
            (1, 'Draft', 'Initial state of the fuel code', 1),
            (2, 'Approved', 'Fuel code has been approved', 2),
            (3, 'Deleted', 'Fuel code has been deleted', 3)
        ON CONFLICT (fuel_code_status_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO level_of_equipment (level_of_equipment_id, name, display_order)
        VALUES
            (1, 'Level 3 - Direct current fast charging', 1),
            (2, 'Level 2 - High voltage, operating above level 1', 2),
            (3, 'Level 1 - Low voltage, operating at 120V AC or less', 3),
            (4, 'Other - Additional information provided in notes field', 4)
        ON CONFLICT (level_of_equipment_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO fuel_measurement_type (fuel_measurement_type_id, type, display_order)
        VALUES
            (1, 'Separate utility meter', 1),
            (2, 'Equipment meter (remote access)', 2),
            (3, 'Equipment meter (physical access)', 3),
            (4, 'No meter or estimated', 4)
        ON CONFLICT (fuel_measurement_type_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO compliance_report_status (compliance_report_status_id, status, effective_status)
        VALUES
            (1, 'Draft', TRUE),
            (2, 'Submitted', TRUE),
            (3, 'Recommended_by_analyst', TRUE),
            (4, 'Recommended_by_manager', TRUE),
            (5, 'Assessed', TRUE),
            (6, 'Reassessed', TRUE)
        ON CONFLICT (compliance_report_status_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO allocation_transaction_type (
            allocation_transaction_type_id, type, description,
            display_order, effective_date, effective_status
        )
        VALUES
            (1, 'Allocated from', 'Fuel allocated from another supplier under an allocation agreement', 1, '2012-01-01', TRUE),
            (2, 'Allocated to', 'Fuel allocated to another supplier under an allocation agreement', 2, '2012-01-01', TRUE)
        ON CONFLICT (allocation_transaction_type_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO end_user_type (type_name, intended_use)
        VALUES
            ('Multi-unit residential building', TRUE),
            ('Fleet', TRUE),
            ('Public', TRUE),
            ('Employee', TRUE)
        ON CONFLICT (type_name) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO notification_type (notification_type_id, name, description, email_content, create_user, update_user)
        VALUES
            (1, 'BCEID__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT', 'Director assessed a compliance report or supplemental report.', 'Email content', 'system', 'system'),
            (2, 'BCEID__INITIATIVE_AGREEMENT__DIRECTOR_APPROVAL', 'Director approved the initiative agreement or transaction', 'Email content', 'system', 'system'),
            (3, 'BCEID__TRANSFER__DIRECTOR_DECISION', 'Director recorded or refused a transfer request', 'Email content', 'system', 'system'),
            (4, 'BCEID__TRANSFER__PARTNER_ACTIONS', 'A transfer partner took action (proposed, declined, rescinded, or signed & submitted) on a transfer request', 'Email content', 'system', 'system'),
            (5, 'IDIR_ANALYST__COMPLIANCE_REPORT__DIRECTOR_DECISION', 'Director assessed compliance report', 'Email content', 'system', 'system'),
            (6, 'IDIR_ANALYST__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION', 'Compliance manager recommended action on the compliance report.', 'Email content', 'system', 'system'),
            (7, 'IDIR_ANALYST__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW', 'Compliance report submitted for government analyst review or returned by compliance manager', 'Email content', 'system', 'system'),
            (8, 'IDIR_ANALYST__INITIATIVE_AGREEMENT__RETURNED_TO_ANALYST', 'Director approved/returned the initiative agreement to the analyst', 'Email content', 'system', 'system'),
            (9, 'IDIR_ANALYST__TRANSFER__DIRECTOR_RECORDED', 'Director recorded or refused a transfer request', 'Email content', 'system', 'system'),
            (10, 'IDIR_ANALYST__TRANSFER__RESCINDED_ACTION', 'A transfer request was rescinded by a transfer partner', 'Email content', 'system', 'system'),
            (11, 'IDIR_ANALYST__TRANSFER__SUBMITTED_FOR_REVIEW', 'Transfer request submitted for government analyst review', 'Email content', 'system', 'system'),
            (12, 'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__ANALYST_RECOMMENDATION', 'Analyst recommendation on the compliance report or returned by the director', 'Email content', 'system', 'system'),
            (13, 'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__DIRECTOR_ASSESSMENT', 'Director assessed a compliance report', 'Email content', 'system', 'system'),
            (14, 'IDIR_COMPLIANCE_MANAGER__COMPLIANCE_REPORT__SUBMITTED_FOR_REVIEW', 'Compliance report submitted for government analyst review', 'Email content', 'system', 'system'),
            (15, 'IDIR_DIRECTOR__COMPLIANCE_REPORT__MANAGER_RECOMMENDATION', 'Compliance manager recommended action on the compliance report', 'Email content', 'system', 'system'),
            (16, 'IDIR_DIRECTOR__INITIATIVE_AGREEMENT__ANALYST_RECOMMENDATION', 'Analyst recommendation provided for the initiative agreement', 'Email content', 'system', 'system'),
            (17, 'IDIR_DIRECTOR__TRANSFER__ANALYST_RECOMMENDATION', 'Analyst recommendation provided for the transfer request', 'Email content', 'system', 'system')
        ON CONFLICT (notification_type_id) DO NOTHING;
    """
    )

    op.execute(
        """
        INSERT INTO notification_channel (notification_channel_id, channel_name, enabled, subscribe_by_default)
        VALUES
            (1, 'EMAIL', TRUE, TRUE),
            (2, 'IN_APP', TRUE, FALSE)
        ON CONFLICT (notification_channel_id) DO NOTHING;
    """
    )

    # Update sequences
    sequence_mappings = {
        "transfer_status": "transfer_status_id",
        "transfer_category": "transfer_category_id",
        "role": "role_id",
        "organization_type": "organization_type_id",
        "organization_status": "organization_status_id",
        "initiative_agreement_status": "initiative_agreement_status_id",
        "compliance_period": "compliance_period_id",
        "admin_adjustment_status": "admin_adjustment_status_id",
        "notification_channel": "notification_channel_id",
        "notification_type": "notification_type_id",
        "end_user_type": "end_user_type_id",
        "compliance_report_status": "compliance_report_status_id",
        "allocation_transaction_type": "allocation_transaction_type_id",
        "provision_of_the_act": "provision_of_the_act_id",
        "transport_mode": "transport_mode_id",
        "fuel_code_prefix": "fuel_code_prefix_id",
        "fuel_code_status": "fuel_code_status_id",
        "fuel_category": "fuel_category_id",
        "fuel_type": "fuel_type_id",
        "unit_of_measure": "uom_id",
        "additional_carbon_intensity": "additional_uci_id",
        "energy_effectiveness_ratio": "eer_id",
        "energy_density": "energy_density_id",
        "target_carbon_intensity": "target_carbon_intensity_id",
        "fuel_instance": "fuel_instance_id",
        "level_of_equipment": "level_of_equipment_id",
        "fuel_measurement_type": "fuel_measurement_type_id",
    }
    for table, id_column in sequence_mappings.items():
        if table == "unit_of_measure":
            op.execute(
                f"""
                SELECT setval('unit_of_measure_uom_id_seq',
                    (SELECT MAX(uom_id) FROM unit_of_measure), true);
            """
            )
        else:
            op.execute(
                f"""
                SELECT setval('{table}_{id_column}_seq',
                    (SELECT MAX({id_column}) FROM {table}), true);
            """
            )

    #
    # (14) bfa7bbb1eea3 (2025-01-03): Update 'Other diesel' -> 'Other diesel fuel'
    #
    op.execute(
        """
        UPDATE fuel_type
        SET fuel_type = 'Other diesel fuel',
            provision_1_id = 3
        WHERE fuel_type = 'Other diesel';
    """
    )

    #
    # (16) 94306eca5261 (2025-01-06): Insert is_legacy to provision_of_the_act
    #
    # Insert new rows (bulk_insert from the snippet)
    # If any of these exact names exist, check for conflict; here we do naive insert
    op.execute(
        """
        INSERT INTO provision_of_the_act (
            name, description, create_user, update_user,
            display_order, effective_date, effective_status,
            expiration_date, is_legacy
        ) VALUES
        (
            'Prescribed carbon intensity - Section 6 (5) (a)',
            'Prescribed carbon intensity - Section 6 (5) (a)',
            'no_user', 'no_user',
            NULL, NULL, TRUE,
            NULL, TRUE
        ),
        (
            'Prescribed carbon intensity - Section 6 (5) (b)',
            'Prescribed carbon intensity - Section 6 (5) (b)',
            'no_user', 'no_user',
            NULL, NULL, TRUE,
            NULL, TRUE
        ),
        (
            'Approved fuel code - Section 6 (5) (c)',
            'Approved fuel code - Section 6 (5) (c)',
            'no_user', 'no_user',
            NULL, NULL, TRUE,
            NULL, TRUE
        ),
        (
            'Default Carbon Intensity Value - Section 6 (5) (d) (i)',
            'Default Carbon Intensity Value - Section 6 (5) (d) (i)',
            'no_user', 'no_user',
            NULL, NULL, TRUE,
            NULL, TRUE
        ),
        (
            'GHGenius modelled - Section 6 (5) (d) (ii) (A)',
            'GHGenius modelled - Section 6 (5) (d) (ii) (A)',
            'no_user', 'no_user',
            NULL, NULL, TRUE,
            NULL, TRUE
        ),
        (
            'Alternative Method - Section 6 (5) (d) (ii) (B)',
            'Alternative Method - Section 6 (5) (d) (ii) (B)',
            'no_user', 'no_user',
            NULL, NULL, TRUE,
            NULL, TRUE
        );
    """
    )

    #
    # (17) fa98709e7952 (2025-01-06): Add legacy fuel types "Natural gas-based gasoline", "Petroleum-based diesel", "Petroleum-based gasoline"
    #
    op.execute(
        """
        INSERT INTO fuel_type (
            fuel_type,
            fossil_derived,
            other_uses_fossil_derived,
            default_carbon_intensity,
            units,
            unrecognized,
            create_user,
            update_user,
            is_legacy
        )
        VALUES
        (
            'Natural gas-based gasoline',
            FALSE,
            TRUE,
            90.07,
            'Litres',
            FALSE,
            'no_user',
            'no_user',
            TRUE
        ),
        (
            'Petroleum-based diesel',
            FALSE,
            TRUE,
            94.76,
            'Litres',
            FALSE,
            'no_user',
            'no_user',
            TRUE
        ),
        (
            'Petroleum-based gasoline',
            FALSE,
            TRUE,
            88.14,
            'Litres',
            FALSE,
            'no_user',
            'no_user',
            TRUE
        );
    """
    )

    op.execute(
        """
        INSERT INTO energy_density (
            fuel_type_id,
            density,
            uom_id,
            create_user,
            update_user
        )
        SELECT
            ft.fuel_type_id,
            CASE
                WHEN ft.fuel_type = 'Natural gas-based gasoline' THEN 34.69
                WHEN ft.fuel_type = 'Petroleum-based diesel' THEN 38.65
                WHEN ft.fuel_type = 'Petroleum-based gasoline' THEN 34.69
            END AS density,
            1 AS uom_id,
            'no_user' AS create_user,
            'no_user' AS update_user
        FROM fuel_type ft
        WHERE ft.fuel_type IN (
            'Natural gas-based gasoline',
            'Petroleum-based diesel',
            'Petroleum-based gasoline'
        );
    """
    )

    op.execute(
        """
        INSERT INTO energy_effectiveness_ratio (
            fuel_category_id,
            fuel_type_id,
            end_use_type_id,
            ratio,
            create_user,
            update_user,
            effective_date,
            effective_status,
            expiration_date
        )
        SELECT
            CASE
                WHEN ft.fuel_type = 'Petroleum-based diesel' THEN 2
                ELSE 1
            END AS fuel_category_id,
            ft.fuel_type_id,
            NULL AS end_use_type_id,
            1.0 AS ratio,
            'no_user' AS create_user,
            'no_user' AS update_user,
            CURRENT_DATE AS effective_date,
            TRUE AS effective_status,
            NULL AS expiration_date
        FROM fuel_type ft
        WHERE ft.fuel_type IN (
            'Natural gas-based gasoline',
            'Petroleum-based diesel',
            'Petroleum-based gasoline'
        );
    """
    )

    #
    # (18) 998929392c8b (2025-01-07): Add marine end use (end_use_type_id=25) plus EER record (eer_id=44)
    #
    op.execute(
        """
        INSERT INTO end_use_type (end_use_type_id, type, intended_use)
        VALUES (25, 'Marine', TRUE)
        ON CONFLICT (end_use_type_id) DO NOTHING;
    """
    )
    op.execute(
        """
        INSERT INTO energy_effectiveness_ratio (
            eer_id, fuel_category_id, fuel_type_id, end_use_type_id, ratio, effective_status
        )
        VALUES (44, 2, 3, 25, 2.5, TRUE)
        ON CONFLICT (eer_id) DO NOTHING;
    """
    )

    #
    # (19) fe03799b4018 (2025-01-14): Update other_uses_fossil_derived for certain fuel types
    #
    op.execute(
        """
        UPDATE fuel_type 
        SET other_uses_fossil_derived = false
        WHERE fuel_type IN (
            'CNG', 'Electricity', 'Hydrogen', 'LNG', 'Propane', 
            'Natural gas-based gasoline', 'Petroleum-based diesel', 
            'Petroleum-based gasoline'
        )
    """
    )
    op.execute(
        """
        UPDATE fuel_type 
        SET other_uses_fossil_derived = true
        WHERE fuel_type IN (
            'Alternative jet fuel', 'Biodiesel', 'Ethanol', 'HDRD',
            'Other diesel fuel', 'Renewable gasoline', 'Renewable naphtha'
        )
    """
    )

    #
    # (20) 5bc0ef48739a (2025-01-15): Add Truck and Marine transport mode
    #                                 (Though it references 'Marine', we already changed it above. We'll do as-is.)
    #
    current_time = datetime.now()
    op.execute(
        f"""
        INSERT INTO transport_mode (transport_mode, create_date, update_date, create_user, update_user)
        VALUES 
            ('Truck', '{current_time}', '{current_time}', 'no_user', 'no_user'),
            ('Marine', '{current_time}', '{current_time}', 'no_user', 'no_user')
    """
    )


def downgrade():
    """
    Consolidated DOWNGRADE logic in reverse chronological order:

    (20) 5bc0ef48739a  (2025-01-15)
    (19) fe03799b4018  (2025-01-14)
    (18) 998929392c8b  (2025-01-07)
    (17) fa98709e7952  (2025-01-06)
    (16) 94306eca5261  (2025-01-06)
    (15) e883ad1f0f60  (2025-01-03)
    (14) bfa7bbb1eea3  (2025-01-03)
    (13) d9cdd9fca0ce  (2024-12-24)
    (12) ab04810d4d7c  (2024-12-22)
    (11) 5fbcb508c1be  (2024-12-21)
    (10) 59873cafbcd8  (2024-12-20)
    (9) 851e09cf8661   (2024-12-17)
    (8) 5d729face5ab   (2024-12-12)
    (7) 7ae38a8413ab   (2024-12-09)
    (6) 26ab15f8ab18   (2024-12-06)
    (5) d4104af84f2b   (2024-12-05)
    (4) 8491890dd688   (2024-12-04)
    (3) 9206124a098b   (2024-12-04)
    (2) aeaa26f5cdd5   (2024-12-02)
    (1) 043c52082a3b   (2024-11-27)
    """

    #
    # (20) 5bc0ef48739a (Downgrade): Remove Truck, Marine transport modes
    #
    op.execute(
        """
        DELETE FROM transport_mode
        WHERE transport_mode IN ('Truck', 'Marine')
    """
    )

    #
    # (19) fe03799b4018 (Downgrade): Revert the other_uses_fossil_derived changes
    #
    op.execute(
        """
        UPDATE fuel_type
        SET other_uses_fossil_derived = true
        WHERE fuel_type IN (
            'CNG', 'Electricity', 'Hydrogen', 'LNG', 'Propane',
            'Natural gas-based gasoline', 'Petroleum-based diesel',
            'Petroleum-based gasoline'
        )
    """
    )
    op.execute(
        """
        UPDATE fuel_type
        SET other_uses_fossil_derived = false
        WHERE fuel_type IN (
            'Alternative jet fuel', 'Biodiesel', 'Ethanol', 'HDRD',
            'Other diesel fuel', 'Renewable gasoline', 'Renewable naphtha'
        )
    """
    )

    #
    # (18) 998929392c8b (Downgrade): Remove EER (id=44) + remove end_use_type (id=25)
    #
    op.execute(
        """
        DELETE FROM energy_effectiveness_ratio
        WHERE eer_id = 44;
    """
    )
    op.execute(
        """
        DELETE FROM end_use_type
        WHERE end_use_type_id = 25;
    """
    )

    #
    # (17) fa98709e7952 (Downgrade): Remove the newly inserted "Natural gas-based gasoline," etc.
    #
    op.execute(
        """
        DELETE FROM energy_effectiveness_ratio
        WHERE fuel_type_id IN (
            SELECT fuel_type_id
            FROM fuel_type
            WHERE fuel_type IN (
                'Natural gas-based gasoline',
                'Petroleum-based diesel',
                'Petroleum-based gasoline'
            )
        );
    """
    )
    op.execute(
        """
        DELETE FROM energy_density
        WHERE fuel_type_id IN (
            SELECT fuel_type_id
            FROM fuel_type
            WHERE fuel_type IN (
                'Natural gas-based gasoline',
                'Petroleum-based diesel',
                'Petroleum-based gasoline'
            )
        );
    """
    )
    op.execute(
        """
        DELETE FROM fuel_type
        WHERE fuel_type IN (
            'Natural gas-based gasoline',
            'Petroleum-based diesel',
            'Petroleum-based gasoline'
        );
    """
    )

    #
    # (16) 94306eca5261 (Downgrade): Drop is_legacy from provision_of_the_act
    #
    op.drop_column("provision_of_the_act", "is_legacy")

    #
    # (14) bfa7bbb1eea3 (Downgrade): Revert fuel_type = 'Other diesel fuel' -> 'Other diesel'
    #
    op.execute(
        """
        UPDATE fuel_type
        SET fuel_type = 'Other diesel',
            provision_1_id = 1
        WHERE fuel_type = 'Other diesel fuel';
    """
    )

    #
    # (13) d9cdd9fca0ce (Downgrade): Clear all seeded data, in groups
    #
    table_groups = [
        [
            "fuel_instance",
            "target_carbon_intensity",
            "additional_carbon_intensity",
            "energy_density",
            "energy_effectiveness_ratio",
            "fuel_code",  # if it exists
        ],
        [
            "notification_channel",
            "notification_type",
            "end_user_type",
            "allocation_transaction_type",
            "compliance_report_status",
            "fuel_measurement_type",
            "level_of_equipment",
        ],
        [
            "fuel_type",
            "fuel_category",
            "transport_mode",
            "fuel_code_prefix",
            "fuel_code_status",
            "end_use_type",
        ],
        [
            "expected_use_type",
            "unit_of_measure",
            "provision_of_the_act",
            "initiative_agreement_status",
            "admin_adjustment_status",
            "transfer_category",
            "transfer_status",
            "role",
            "organization_status",
            "organization_type",
            "compliance_period",
        ],
    ]
    for group in table_groups:
        tables_list = ", ".join(group)
        op.execute(f"TRUNCATE TABLE {tables_list} CASCADE;")

    #
    # (12) ab04810d4d7c (Downgrade): Drop unique constraint from target_carbon_intensity
    #
    op.drop_constraint(
        "uq_target_carbon_intensity_compliance_fuel",
        "target_carbon_intensity",
        type_="unique",
    )

    #
    # (11) 5fbcb508c1be (Downgrade): Rename end_use_type_id=19 back
    #
    op.execute(
        """
        UPDATE end_use_type
        SET type = 'Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 51 to 75% of load range'
        WHERE end_use_type_id = 19
    """
    )

    #
    # (10) 59873cafbcd8 (Downgrade): Restore 'Other diesel' fossil_derived = true, other_uses_fossil_derived = true
    #
    op.execute(
        """
        UPDATE fuel_type 
        SET fossil_derived = true, other_uses_fossil_derived = true 
        WHERE fuel_type = 'Other diesel'
    """
    )

    #
    # (9) 851e09cf8661 (Downgrade): Drop the default_carbon_intensity column from fuel_category
    #
    op.drop_column("fuel_category", "default_carbon_intensity")

    #
    # (8) 5d729face5ab (Downgrade): Revert default_carbon_intensity of 'Other diesel' (id=20) to 94.38
    #
    op.execute(
        """
        UPDATE fuel_type
        SET default_carbon_intensity = 94.38
        WHERE fuel_type_id = 20
    """
    )

    #
    # (7) 7ae38a8413ab (Downgrade): Revert volume-based fuels to false, gas-based to true
    #
    current_time = datetime.now()
    op.execute(
        f"""
        UPDATE fuel_type
        SET other_uses_fossil_derived = false,
            update_date = '{current_time}',
            update_user = 'no_user'
        WHERE fuel_type IN (
            'Alternative jet fuel',
            'Biodiesel',
            'Ethanol',
            'HDRD',
            'Renewable gasoline',
            'Renewable naphtha'
        )
    """
    )
    op.execute(
        f"""
        UPDATE fuel_type
        SET other_uses_fossil_derived = true,
            update_date = '{current_time}',
            update_user = 'no_user'
        WHERE fuel_type IN (
            'CNG',
            'Electricity',
            'Hydrogen',
            'LNG',
            'Propane'
        )
    """
    )

    #
    # (6) 26ab15f8ab18 (Downgrade): Restore original end_use_type + additional_carbon_intensity + EER
    #
    current_time = datetime.now()
    original_values = [
        (14, "Marine", "General"),
        (15, "Marine", "Operated within 51 to 75% of load range"),
        (16, "Marine", "Operated within 76 to 100% of load range"),
        (17, "Marine, w/ methane slip reduction kit", "General"),
        (
            18,
            "Marine, w/ methane slip reduction kit",
            "Operated within 51 to 75% of load range",
        ),
        (
            19,
            "Marine, w/ methane slip reduction kit",
            "Operated within 76 to 100% of load range",
        ),
        (20, "Unknown", None),
        (21, "Aircraft", None),
    ]
    for end_use_id, type_name, sub_type in original_values:
        if sub_type:
            op.execute(
                f"""
                UPDATE end_use_type 
                SET type = '{type_name}',
                    sub_type = '{sub_type}',
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE end_use_type_id = {end_use_id}
            """
            )
        else:
            op.execute(
                f"""
                UPDATE end_use_type 
                SET type = '{type_name}',
                    sub_type = NULL,
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE end_use_type_id = {end_use_id}
            """
            )

    uci_originals = [
        (1, 7, 5, 14, 27.3),
        (2, 7, 5, 15, 17.8),
        (3, 7, 5, 16, 12.2),
        (4, 7, 5, 17, 10.6),
        (5, 7, 5, 18, 8.4),
        (6, 7, 5, 19, 8.0),
        (7, 7, 5, 20, 27.3),
        (8, 7, 5, None, 0),
        (9, None, 5, None, 0),
    ]
    for uci_id, fuel_type_id, uom_id, eut_id, intensity in uci_originals:
        if fuel_type_id and eut_id:
            op.execute(
                f"""
                UPDATE additional_carbon_intensity
                SET fuel_type_id = {fuel_type_id},
                    uom_id = {uom_id},
                    end_use_type_id = {eut_id},
                    intensity = {intensity},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {uci_id}
            """
            )
        elif fuel_type_id:
            op.execute(
                f"""
                UPDATE additional_carbon_intensity
                SET fuel_type_id = {fuel_type_id},
                    uom_id = {uom_id},
                    end_use_type_id = NULL,
                    intensity = {intensity},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {uci_id}
            """
            )
        else:
            op.execute(
                f"""
                UPDATE additional_carbon_intensity
                SET fuel_type_id = NULL,
                    uom_id = {uom_id},
                    end_use_type_id = NULL,
                    intensity = {intensity},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE additional_uci_id = {uci_id}
            """
            )

    eer_originals = [
        (14, 2, 3, 14, 2.5),
        (15, 2, 3, 10, 2.8),
        (16, 2, 3, 11, 2.4),
        (17, 2, 3, 2, 1.0),
        (18, 2, 6, 3, 1.8),
        (19, 2, 6, 2, 0.9),
        (20, 2, 7, 12, 1.0),
        (21, 2, 7, 2, 0.9),
        (22, 2, 13, None, 0.9),
        (23, 3, 3, None, 2.5),
        (24, 3, 11, None, 1.0),
    ]
    for eer_id, fc_id, ft_id, eut_id, ratio in eer_originals:
        if eut_id:
            op.execute(
                f"""
                UPDATE energy_effectiveness_ratio 
                SET fuel_category_id = {fc_id},
                    fuel_type_id = {ft_id},
                    end_use_type_id = {eut_id},
                    ratio = {ratio},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE eer_id = {eer_id}
            """
            )
        else:
            op.execute(
                f"""
                UPDATE energy_effectiveness_ratio 
                SET fuel_category_id = {fc_id},
                    fuel_type_id = {ft_id},
                    end_use_type_id = NULL,
                    ratio = {ratio},
                    update_date = '{current_time}',
                    update_user = 'no_user'
                WHERE eer_id = {eer_id}
            """
            )

    #
    # (5) d4104af84f2b (Downgrade): Restore notification_type table to old enum-based approach
    #
    op.execute("DELETE FROM notification_type;")

    # Recreate old enum
    notification_type_enum_v2 = ENUM(
        "TRANSFER_PARTNER_UPDATE",
        "TRANSFER_DIRECTOR_REVIEW",
        "INITIATIVE_APPROVED",
        "INITIATIVE_DA_REQUEST",
        "SUPPLEMENTAL_REQUESTED",
        "DIRECTOR_ASSESSMENT",
        name="notification_type_enum_v2",
    )
    notification_type_enum_v2.create(op.get_bind(), checkfirst=False)

    # Convert the name column back to enum
    with op.batch_alter_table("notification_type") as batch_op:
        batch_op.alter_column(
            "name",
            type_=notification_type_enum_v2,
            postgresql_using="name::notification_type_enum_v2",
            existing_type=sa.String(length=255),
            existing_nullable=False,
        )

    # Re-insert old data
    op.execute(
        """
        INSERT INTO notification_type (notification_type_id, name, description, email_content, create_user, update_user)
        VALUES
            (1, 'TRANSFER_PARTNER_UPDATE', 'Transfer partner update notification', 'Email content for transfer partner update', 'system', 'system'),
            (2, 'TRANSFER_DIRECTOR_REVIEW', 'Director review notification', 'Email content for director review', 'system', 'system'),
            (3, 'INITIATIVE_APPROVED', 'Initiative approved notification', 'Email content for initiative approval', 'system', 'system'),
            (4, 'INITIATIVE_DA_REQUEST', 'DA request notification', 'Email content for DA request', 'system', 'system'),
            (5, 'SUPPLEMENTAL_REQUESTED', 'Supplemental requested notification', 'Email content for supplemental request', 'system', 'system'),
            (6, 'DIRECTOR_ASSESSMENT', 'Director assessment notification', 'Email content for director assessment', 'system', 'system');
    """
    )

    op.execute(
        """
        SELECT setval('notification_type_notification_type_id_seq',
            (SELECT MAX(notification_type_id) FROM notification_type));
    """
    )

    #
    # (4) 8491890dd688 (Downgrade): No direct reversion steps were provided, so pass.
    #
    #   The original only did data updates; no direct reverts specified.
    pass

    #
    # (3) 9206124a098b (Downgrade): Remove column organization_name from final_supply_equipment
    #
    op.drop_column("final_supply_equipment", "organization_name")

    #
    # (2) aeaa26f5cdd5 (Downgrade): Revert "Other - Additional information..." to "Other" in level_of_equipment
    #
    op.execute(
        """
        UPDATE level_of_equipment
        SET name = 'Other'
        WHERE name = 'Other - Additional information provided in notes field'
    """
    )

    #
    # (1) 043c52082a3b (Downgrade): Revert Marine-domestic -> Marine and remove Marine-international
    #
    op.execute(
        f"""
        UPDATE transport_mode
        SET transport_mode = 'Marine',
            update_date = '{datetime.utcnow()}',
            update_user = 'no_user'
        WHERE transport_mode = 'Marine-domestic'
    """
    )
    op.execute(
        """
        DELETE FROM transport_mode
        WHERE transport_mode = 'Marine-international'
    """
    )
