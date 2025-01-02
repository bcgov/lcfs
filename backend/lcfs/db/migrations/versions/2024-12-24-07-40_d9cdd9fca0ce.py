"""move common seeders to migrations

Revision ID: d9cdd9fca0ce
Revises: 5fbcb508c1be
Create Date: 2024-12-24 07:40:08.332121
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = "d9cdd9fca0ce"
down_revision = "ab04810d4d7c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Compliance Periods
    dates = [(year, f"{year}-01-01", f"{year}-12-31")
             for year in range(2010, 2033)]
    for i, (year, start_date, end_date) in enumerate(dates, 1):
        op.execute(f"""
            INSERT INTO compliance_period (
                compliance_period_id, description, display_order,
                effective_date, expiration_date, effective_status
            )
            VALUES (
                {i}, '{year}', {i},
                '{start_date}', '{end_date}', TRUE
            )
            ON CONFLICT (compliance_period_id) DO NOTHING;
        """)

    # 2. Organization Types
    op.execute("""
        INSERT INTO organization_type (organization_type_id, org_type, description)
        VALUES
            (1, 'fuel_supplier', 'Fuel Supplier'),
            (2, 'electricity_supplier', 'Electricity Supplier'),
            (3, 'broker', 'Broker'),
            (4, 'utilities', 'Utilities (local or public)')
        ON CONFLICT (organization_type_id) DO NOTHING;
    """)

    # 3. Organization Statuses
    op.execute("""
        INSERT INTO organization_status (organization_status_id, status, description)
        VALUES
            (1, 'Unregistered', 'Unregistered'),
            (2, 'Registered', 'Registered'),
            (3, 'Suspended', 'Suspended'),
            (4, 'Canceled', 'Canceled')
        ON CONFLICT (organization_status_id) DO NOTHING;
    """)

    # 4. Roles
    op.execute("""
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
    """)

    # 5. Transfer Statuses
    op.execute("""
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
    """)

    # 6. Transfer Categories
    op.execute("""
        INSERT INTO transfer_category (transfer_category_id, category, effective_status)
        VALUES
            (1, 'A', TRUE),
            (2, 'B', TRUE),
            (3, 'C', TRUE),
            (4, 'D', TRUE)
        ON CONFLICT (transfer_category_id) DO NOTHING;
    """)

    # 7. Admin Adjustment Statuses
    op.execute("""
        INSERT INTO admin_adjustment_status (admin_adjustment_status_id, status)
        VALUES
            (1, 'Draft'),
            (2, 'Recommended'),
            (3, 'Approved'),
            (4, 'Deleted')
        ON CONFLICT (admin_adjustment_status_id) DO NOTHING;
    """)

    # 8. Initiative Agreement Statuses
    op.execute("""
        INSERT INTO initiative_agreement_status (initiative_agreement_status_id, status)
        VALUES
            (1, 'Draft'),
            (2, 'Recommended'),
            (3, 'Approved'),
            (4, 'Deleted')
        ON CONFLICT (initiative_agreement_status_id) DO NOTHING;
    """)

    # 9. Static Fuel Data
    # Expected Use Types
    op.execute("""
        INSERT INTO expected_use_type (expected_use_type_id, name, description, effective_status)
        VALUES
            (1, 'Heating oil', 'Fuel used for heating purposes', TRUE),
            (2, 'Other', 'Other type of fuel description', TRUE)
        ON CONFLICT (expected_use_type_id) DO NOTHING;
    """)

    # Unit of Measures first
    op.execute("""
        INSERT INTO unit_of_measure (uom_id, name, description)
        VALUES
            (1, 'MJ/L', 'Megajoules per litre'),
            (2, 'MJ/kWh', 'Megajoules per kilowatt hour'),
            (3, 'MJ/m³', 'Megajoules per cubic metre'),
            (4, 'MJ/kg', 'Megajoules per kilogram'),
            (5, 'gCO²e/MJ', 'grams of carbon dioxide equivalent per megajoule')
        ON CONFLICT (uom_id) DO NOTHING;
    """)

    # End Use Types
    op.execute("""
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
            (19, 'Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 26 to 75% of load range', TRUE),
            (20, 'Compression-ignition engine- Marine, with methane slip reduction kit- Operated within 76 to 100% of load range', TRUE),
            (21, 'Compression-ignition engine- Marine, unknown whether kit is installed or average operating load range', TRUE),
            (22, 'Unknown engine type', TRUE),
            (23, 'Other (i.e. road transportation)', TRUE)
        ON CONFLICT (end_use_type_id) DO NOTHING;
               
    """)

    # Provision Acts
    op.execute("""
        INSERT INTO provision_of_the_act (provision_of_the_act_id, name, description, effective_status)
        VALUES
            (1, 'Prescribed carbon intensity - section 19 (a)', 'Prescribed carbon intensity - section 19 (a)', TRUE),
            (2, 'Fuel code - section 19 (b) (i)', 'Fuel code - section 19 (b) (i)', TRUE),
            (3, 'Default carbon intensity - section 19 (b) (ii)', 'Default carbon intensity - section 19 (b) (ii)', TRUE)
        ON CONFLICT (provision_of_the_act_id) DO NOTHING;
    """)

    # Fuel Categories
    op.execute("""
        INSERT INTO fuel_category (fuel_category_id, category, description, default_carbon_intensity, effective_status)
        VALUES
            (1, 'Gasoline', 'Gasoline', 93.67, TRUE),
            (2, 'Diesel', 'Diesel', 100.21, TRUE),
            (3, 'Jet fuel', 'Jet fuel', 88.83, TRUE)
        ON CONFLICT (fuel_category_id) DO NOTHING;
    """)

    # Fuel Types
    op.execute("""
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
    """)

    # Energy Effectiveness Ratios
    op.execute("""
        INSERT INTO energy_effectiveness_ratio (
            eer_id, fuel_category_id, fuel_type_id, end_use_type_id, ratio, effective_status
        )
        VALUES
            (1, 1, 2, NULL, 0.9, TRUE),
            (2, 1, 3, 1, 3.5, TRUE),
            (3, 1, 3, 2, 1.0, TRUE),
            (4, 1, 6, 3, 2.4, TRUE),
            (5, 1, 6, 2, 0.9, TRUE),
            (6, 1, 13, NULL, 0.9, TRUE),
            (7, 2, 2, NULL, 0.9, TRUE),
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
            (19, 2, 13, NULL, 0.9, TRUE),
            (20, 3, 3, NULL, 2.5, TRUE),
            (21, 3, 11, NULL, 1.0, TRUE),
            (22, 2, 7, 15, 1.0, TRUE),
            (23, 2, 7, 16, 1.0, TRUE),
            (24, 2, 7, 17, 1.0, TRUE),
            (25, 2, 7, 18, 1.0, TRUE),
            (26, 2, 7, 19, 1.0, TRUE),
            (27, 2, 7, 20, 1.0, TRUE),
            (28, 2, 7, 21, 1.0, TRUE),
            (29, 2, 7, 22, 0.9, TRUE),
            (30, 2, 7, 23, 0.9, TRUE)
        ON CONFLICT (eer_id) DO NOTHING;
    """)

    # Now Additional Carbon Intensities
    op.execute("""
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
    """)

    # Energy Densities
    op.execute("""
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
    """)

    # Target Carbon Intensities
    op.execute("""
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
    """)

    # Fuel Instances
    op.execute("""
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
    """)

    # Transport Modes
    op.execute("""
        INSERT INTO transport_mode (transport_mode_id, transport_mode)
        VALUES
            (1, 'Truck'),
            (2, 'Rail'),
            (3, 'Marine-domestic'),
            (4, 'Adjacent'),
            (5, 'Pipeline')
        ON CONFLICT (transport_mode_id) DO NOTHING;
    """)

    # Fuel Code Prefixes
    op.execute("""
        INSERT INTO fuel_code_prefix (fuel_code_prefix_id, prefix)
        VALUES
            (1, 'BCLCF'),
            (2, 'PROXY')
        ON CONFLICT (fuel_code_prefix_id) DO NOTHING;
    """)

    # Fuel Code Statuses
    op.execute("""
        INSERT INTO fuel_code_status (fuel_code_status_id, status, description, display_order)
        VALUES
            (1, 'Draft', 'Initial state of the fuel code', 1),
            (2, 'Approved', 'Fuel code has been approved', 2),
            (3, 'Deleted', 'Fuel code has been deleted', 3)
        ON CONFLICT (fuel_code_status_id) DO NOTHING;
    """)

    # Level of Equipment
    op.execute("""
        INSERT INTO level_of_equipment (level_of_equipment_id, name, display_order)
        VALUES
            (1, 'Level 3 - Direct current fast charging', 1),
            (2, 'Level 2 - High voltage, operating above level 1', 2),
            (3, 'Level 1 - Low voltage, operating at 120V AC or less', 3),
            (4, 'Other - Additional information provided in notes field', 4)
        ON CONFLICT (level_of_equipment_id) DO NOTHING;
    """)

    # Fuel Measurement Types
    op.execute("""
        INSERT INTO fuel_measurement_type (fuel_measurement_type_id, type, display_order)
        VALUES
            (1, 'Separate utility meter', 1),
            (2, 'Equipment meter (remote access)', 2),
            (3, 'Equipment meter (physical access)', 3),
            (4, 'No meter or estimated', 4)
        ON CONFLICT (fuel_measurement_type_id) DO NOTHING;
    """)

    # 10. Compliance Report Statuses
    op.execute("""
        INSERT INTO compliance_report_status (compliance_report_status_id, status, effective_status)
        VALUES
            (1, 'Draft', TRUE),
            (2, 'Submitted', TRUE),
            (3, 'Recommended_by_analyst', TRUE),
            (4, 'Recommended_by_manager', TRUE),
            (5, 'Assessed', TRUE),
            (6, 'ReAssessed', TRUE)
        ON CONFLICT (compliance_report_status_id) DO NOTHING;
    """)

    # 11. Allocation Transaction Types
    op.execute("""
        INSERT INTO allocation_transaction_type (
            allocation_transaction_type_id, type, description,
            display_order, effective_date, effective_status
        )
        VALUES
            (1, 'Allocated from', 'Fuel allocated from another supplier under an allocation agreement', 1, '2012-01-01', TRUE),
            (2, 'Allocated to', 'Fuel allocated to another supplier under an allocation agreement', 2, '2012-01-01', TRUE)
        ON CONFLICT (allocation_transaction_type_id) DO NOTHING;
    """)

    # 12. End User Types
    op.execute("""
        INSERT INTO end_user_type (type_name, intended_use)
        VALUES
            ('Multi-unit residential building', TRUE),
            ('Fleet', TRUE),
            ('Public', TRUE),
            ('Employee', TRUE)
        ON CONFLICT (type_name) DO NOTHING;
    """)

    # 13. Notification Types
    op.execute("""
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
    """)

    # 14. Notification Channels
    op.execute("""
        INSERT INTO notification_channel (notification_channel_id, channel_name, enabled, subscribe_by_default)
        VALUES
            (1, 'EMAIL', TRUE, TRUE),
            (2, 'IN_APP', TRUE, FALSE)
        ON CONFLICT (notification_channel_id) DO NOTHING;
    """)

    # Update sequences
    sequence_mappings = {
        'transfer_status': 'transfer_status_id',
        'transfer_category': 'transfer_category_id',
        'role': 'role_id',
        'organization_type': 'organization_type_id',
        'organization_status': 'organization_status_id',
        'initiative_agreement_status': 'initiative_agreement_status_id',
        'compliance_period': 'compliance_period_id',
        'admin_adjustment_status': 'admin_adjustment_status_id',
        'notification_channel': 'notification_channel_id',
        'notification_type': 'notification_type_id',
        'end_user_type': 'end_user_type_id',
        'compliance_report_status': 'compliance_report_status_id',
        'allocation_transaction_type': 'allocation_transaction_type_id',
        'provision_of_the_act': 'provision_of_the_act_id',
        'transport_mode': 'transport_mode_id',
        'fuel_code_prefix': 'fuel_code_prefix_id',
        'fuel_code_status': 'fuel_code_status_id',
        'fuel_category': 'fuel_category_id',
        'fuel_type': 'fuel_type_id',
        'unit_of_measure': 'uom_id',  # Both column and sequence use uom_id
        'additional_carbon_intensity': 'additional_uci_id',
        'energy_effectiveness_ratio': 'eer_id',
        'energy_density': 'energy_density_id',
        'target_carbon_intensity': 'target_carbon_intensity_id',
        'fuel_instance': 'fuel_instance_id',
        'level_of_equipment': 'level_of_equipment_id',
        'fuel_measurement_type': 'fuel_measurement_type_id'
    }

    for table, id_column in sequence_mappings.items():
        if table == 'unit_of_measure':
            # Special case for unit_of_measure table
            op.execute(f"""
                SELECT setval('unit_of_measure_uom_id_seq',
                    (SELECT MAX(uom_id) FROM unit_of_measure), true);
            """)
        else:
            op.execute(f"""
                SELECT setval('{table}_{id_column}_seq',
                    (SELECT MAX({id_column}) FROM {table}), true);
            """)


def downgrade() -> None:
    # Clear all seeded data in reverse order of creation, respecting foreign key constraints
    table_groups = [
        # Group 1 - Most dependent tables (records with multiple foreign keys)
        [
            'fuel_instance',  # Depends on fuel_type and fuel_category
            'target_carbon_intensity',  # Depends on compliance_period and fuel_category
            'additional_carbon_intensity',  # Depends on fuel_type and end_use_type
            'energy_density',  # Depends on fuel_type and uom
            'energy_effectiveness_ratio',  # Added here since it depends on end_use_type
            'fuel_code',  # If exists, depends on several tables
        ],

        # Group 2 - Tables with single foreign key dependencies
        [
            'notification_channel',
            'notification_type',
            'end_user_type',
            'allocation_transaction_type',
            'compliance_report_status',
            'fuel_measurement_type',
            'level_of_equipment',
        ],

        # Group 3 - Core reference tables with dependencies
        [
            'fuel_type',  # Depends on provision_of_the_act
            'fuel_category',
            'transport_mode',
            'fuel_code_prefix',
            'fuel_code_status',
            'end_use_type',
        ],

        # Group 4 - Base reference tables (no dependencies)
        [
            'expected_use_type',
            'unit_of_measure',
            'provision_of_the_act',
            'initiative_agreement_status',
            'admin_adjustment_status',
            'transfer_category',
            'transfer_status',
            'role',
            'organization_status',
            'organization_type',
            'compliance_period'
        ]
    ]

    # Execute TRUNCATE for each group
    for group in table_groups:
        tables_list = ', '.join(group)
        op.execute(f"TRUNCATE TABLE {tables_list} CASCADE;")
