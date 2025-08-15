"""Populate missing organization snapshots for compliance reports

Revision ID: 8e530edb155f
Revises: 87592f5136b3
Create Date: 2025-04-19 08:50:58.195991

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision = "8e530edb155f"
down_revision = "87592f5136b3"
branch_labels = None
depends_on = None

# Define a unique user identifier for this migration
MIGRATION_USER = "ALEMBIC_8e530edb155f"


def upgrade() -> None:
    # Get connection bind for execution
    conn = op.get_bind()

    # Find compliance reports missing a snapshot
    missing_reports_query = text(
        """
        SELECT cr.compliance_report_id, cr.organization_id
        FROM compliance_report cr
        LEFT JOIN compliance_report_organization_snapshot cros
            ON cr.compliance_report_id = cros.compliance_report_id
        WHERE cros.organization_snapshot_id IS NULL
        """
    )
    result = conn.execute(missing_reports_query)
    missing_reports = result.fetchall()

    print(
        f"Found {len(missing_reports)} compliance reports missing organization snapshots."
    )

    # SQL to fetch organization details
    get_org_query = text(
        """
        SELECT name, operating_name, email, phone, records_address,
               organization_address_id, organization_attorney_address_id
        FROM organization
        WHERE organization_id = :org_id
        """
    )

    # SQL to fetch address details
    get_addr_query = text(
        """
        SELECT street_address, address_other, city, province_state, country, \"postalCode_zipCode\"
        FROM {table_name}
        WHERE {id_column} = :addr_id
        """
    )

    # SQL to insert snapshot
    insert_snapshot_query = text(
        """
        INSERT INTO compliance_report_organization_snapshot (
            compliance_report_id, name, operating_name, email, phone,
            head_office_address, records_address, service_address,
            is_edited, create_date, update_date, create_user, update_user
        )
        VALUES (
            :cr_id, :name, :op_name, :email, :phone,
            :head_addr, :rec_addr, :svc_addr,
            false, NOW(), NOW(), :user, :user
        )
        """
    )

    snapshots_created = 0
    for report in missing_reports:
        cr_id = report.compliance_report_id
        org_id = report.organization_id

        print(f"Processing report ID: {cr_id}, Org ID: {org_id}")

        # Fetch organization details using conn.execute
        org_result = conn.execute(get_org_query, {"org_id": org_id})
        org_row = org_result.fetchone()

        if not org_row:
            print(
                f"WARN: Organization data not found for org_id: {org_id}. Skipping report {cr_id}."
            )
            continue

        org_data = dict(org_row._mapping)  # Convert RowProxy to dict

        # Fetch addresses using conn.execute
        service_address_data = None
        if org_data.get("organization_address_id"):
            # Manually format the query string
            addr_sql_str = str(get_addr_query).format(
                table_name="organization_address", id_column="organization_address_id"
            )
            service_address_result = conn.execute(
                text(addr_sql_str), {"addr_id": org_data["organization_address_id"]}
            )
            service_address_row = service_address_result.fetchone()
            if service_address_row:
                service_address_data = dict(service_address_row._mapping)
            else:
                print(
                    f"WARN: Service address data not found for organization_address_id: {org_data['organization_address_id']}"
                )
        else:
            print(f"WARN: No organization_address_id found for org_id: {org_id}")

        attorney_address_data = None
        if org_data.get("organization_attorney_address_id"):
            addr_sql_str = str(get_addr_query).format(
                table_name="organization_attorney_address",
                id_column="organization_attorney_address_id",
            )
            attorney_address_result = conn.execute(
                text(addr_sql_str),
                {"addr_id": org_data["organization_attorney_address_id"]},
            )
            attorney_address_row = attorney_address_result.fetchone()
            if attorney_address_row:
                attorney_address_data = dict(attorney_address_row._mapping)
            else:
                print(
                    f"WARN: Attorney address data not found for organization_attorney_address_id: {org_data['organization_attorney_address_id']}"
                )
        else:
            print(
                f"WARN: No organization_attorney_address_id found for org_id: {org_id}"
            )

        # Build address strings
        def build_address_string(addr_dict):
            if not addr_dict:
                return None
            parts = [
                addr_dict.get("street_address"),
                addr_dict.get("address_other"),
                addr_dict.get("city"),
                addr_dict.get("province_state"),
                addr_dict.get("country"),
                addr_dict.get("postalCode_zipCode"),
            ]
            return ", ".join(filter(None, [p.strip() if p else None for p in parts]))

        service_address = build_address_string(service_address_data)
        head_office_address = build_address_string(attorney_address_data)

        # Insert the snapshot using conn.execute
        result = conn.execute(
            insert_snapshot_query,
            {
                "cr_id": cr_id,
                "name": org_data.get("name"),
                "op_name": org_data.get("operating_name") or org_data.get("name"),
                "email": org_data.get("email"),
                "phone": org_data.get("phone"),
                "head_addr": head_office_address,
                "rec_addr": org_data.get("records_address"),
                "svc_addr": service_address,
                "user": MIGRATION_USER,
            },
        )
        # Check rowcount for confirmation, although ON CONFLICT might affect it
        if result.rowcount > 0:
            snapshots_created += 1
            print(f"OK: Created snapshot for report ID: {cr_id}")
        else:
            print(
                f"WARN: Snapshot might already exist or insert failed (0 rows affected) for report ID: {cr_id}"
            )

    print(f"Finished. Successfully created {snapshots_created} organization snapshots.")


def downgrade() -> None:
    # Delete only the snapshots created by this specific migration
    conn = op.get_bind()
    delete_query = text(
        """
        DELETE FROM compliance_report_organization_snapshot
        WHERE create_user = :user
        """
    )
    try:
        result = conn.execute(delete_query, {"user": MIGRATION_USER})
        print(
            f"Downgrade: Deleted {result.rowcount} organization snapshots created by migration {revision}."
        )
    except Exception as e:
        print(f"ERROR during downgrade delete for migration {revision}: {e}")
