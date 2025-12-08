"""Consolidate charging infrastructure migrations and enforce 3 digit equipment numbers

Revision ID: bbfbe5d4c7e8
Revises: a7b8c9d0e1f2
Create Date: 2025-11-25 09:30:00.000000

"""

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy.engine import CursorResult
from alembic import op
from lcfs.utils.unique_key_generators import next_base36

# revision identifiers, used by Alembic.
revision = "bbfbe5d4c7e8"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None

SYSTEM_USER = "system_migration"


def upgrade() -> None:
    bind = op.get_bind()
    session = sa.orm.Session(bind=bind)

    try:
        normalized = _normalize_equipment_numbers(session)
        _ensure_version_baseline(session)
        site_created, site_updated = _seed_charging_sites(session)
        equipment_created, equipment_updated = _seed_charging_equipment(session)
        site_user_links = _seed_charging_site_intended_users(session)
        equipment_use_links = _seed_equipment_intended_uses(session)
        equipment_user_links = _seed_equipment_intended_users(session)
        compliance_count = _seed_compliance_associations(session)

        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    _enforce_three_digit_equipment_numbers()

    print("Charging infrastructure migration summary:")
    print(f" - Normalized equipment numbers: {normalized}")
    print(
        f" - Charging sites created: {site_created}, updated: {site_updated}"
    )
    print(
        f" - Charging equipment created: {equipment_created}, updated: {equipment_updated}"
    )
    print(f" - Charging site intended user links created: {site_user_links}")
    print(f" - Charging equipment intended use links created: {equipment_use_links}")
    print(f" - Charging equipment intended user links created: {equipment_user_links}")
    print(f" - Compliance report associations created: {compliance_count}")


def downgrade() -> None:
    _drop_three_digit_constraint()

    op.execute(
        """
        UPDATE charging_equipment
        SET equipment_number = LPAD(equipment_number, 3, '0')
        """
    )
    op.execute(
        "ALTER TABLE charging_equipment ALTER COLUMN equipment_number TYPE VARCHAR(5)"
    )

    op.execute(
        """
        DELETE FROM compliance_report_charging_equipment
        WHERE compliance_notes LIKE 'Migrated from FSE compliance association%%'
        """
    )
    op.execute(
        """
        DELETE FROM charging_equipment_intended_user_association
        WHERE charging_equipment_id IN (
            SELECT charging_equipment_id
            FROM charging_equipment
            WHERE notes LIKE 'FSE ID:%'
        )
        """
    )
    op.execute(
        """
        DELETE FROM charging_equipment_intended_use_association
        WHERE charging_equipment_id IN (
            SELECT charging_equipment_id
            FROM charging_equipment
            WHERE notes LIKE 'FSE ID:%'
        )
        """
    )
    op.execute(
        """
        DELETE FROM charging_equipment
        WHERE notes LIKE 'FSE ID:%'
        """
    )
    op.execute("DELETE FROM charging_site WHERE create_user = 'system_migration'")


def _normalize_equipment_numbers(session: sa.orm.Session) -> int:
    violation = session.execute(
        sa.text(
            """
            SELECT charging_site_id, COUNT(*) AS equipment_count
            FROM charging_equipment
            GROUP BY charging_site_id
            HAVING COUNT(*) > 999
            LIMIT 1
            """
        )
    ).first()
    if violation:
        raise ValueError(
            f"Charging site {violation.charging_site_id} exceeds the 3-digit equipment limit"
        )

    result = session.execute(
        sa.text(
            """
            WITH ordered AS (
                SELECT
                    charging_equipment_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY charging_site_id
                        ORDER BY
                            LPAD(
                                COALESCE(
                                    NULLIF(REGEXP_REPLACE(equipment_number, '[^0-9]', '', 'g'), ''),
                                    '0'
                                ),
                                5,
                                '0'
                            ),
                            charging_equipment_id
                    ) AS rn
                FROM charging_equipment
            )
            UPDATE charging_equipment ce
            SET equipment_number = LPAD(ordered.rn::text, 3, '0')
            FROM ordered
            WHERE ce.charging_equipment_id = ordered.charging_equipment_id
            """
        )
    )
    return _rows_affected(result)


def _seed_charging_sites(session: sa.orm.Session) -> tuple[int, int]:
    site_status_map, default_status_id = _get_status_map(
        session, "charging_site_status", "charging_site_status_id"
    )
    default_status_id = default_status_id or 1

    site_locations = session.execute(
        sa.text(
            """
            WITH aggregated AS (
                SELECT
                    cr.organization_id,
                    fse.street_address,
                    fse.city,
                    fse.postal_code,
                    AVG(fse.latitude) AS avg_latitude,
                    AVG(fse.longitude) AS avg_longitude,
                    STRING_AGG(DISTINCT fse.notes, '; ') AS combined_notes,
                    MAX(NULLIF(TRIM(fse.organization_name), '')) AS allocating_org_name,
                    COUNT(*) AS equipment_count,
                    MIN(
                        CASE
                            WHEN LOWER(COALESCE(crs.status::text, '')) = 'draft' THEN 1
                            WHEN LOWER(COALESCE(crs.status::text, '')) = 'submitted' THEN 2
                            ELSE 3
                        END
                    ) AS status_rank
                FROM final_supply_equipment fse
                JOIN compliance_report cr
                    ON fse.compliance_report_id = cr.compliance_report_id
                LEFT JOIN compliance_report_status crs
                    ON cr.current_status_id = crs.compliance_report_status_id
                WHERE
                    fse.street_address IS NOT NULL AND fse.street_address <> ''
                    AND fse.city IS NOT NULL AND fse.city <> ''
                    AND fse.postal_code IS NOT NULL AND fse.postal_code <> ''
                GROUP BY
                    cr.organization_id,
                    fse.street_address,
                    fse.city,
                    fse.postal_code
            )
            SELECT
                ag.*,
                cs.charging_site_id,
                cs.create_user AS existing_create_user
            FROM aggregated ag
            LEFT JOIN charging_site cs
                ON cs.organization_id = ag.organization_id
                AND cs.street_address = ag.street_address
                AND cs.city = ag.city
                AND cs.postal_code = ag.postal_code
            ORDER BY ag.organization_id, ag.street_address
            """
        )
    ).fetchall()

    if not site_locations:
        return (0, 0)

    site_code = session.execute(
        sa.text("SELECT max(site_code) FROM charging_site")
    ).scalar()
    current_time = datetime.now(timezone.utc)
    inserted = 0
    updated = 0

    for location in site_locations:
        status_rank = int(location.status_rank or 3)
        status_id = _status_id_from_rank(
            status_rank, site_status_map, default_status_id
        )
        notes = f"Extracted from {location.equipment_count} FSE records."
        if location.combined_notes:
            notes += f" Original notes: {location.combined_notes}"

        if location.charging_site_id:
            result = session.execute(
                sa.text(
                    """
                    UPDATE charging_site
                    SET
                        latitude = :latitude,
                        longitude = :longitude,
                        status_id = :status_id,
                        allocating_organization_name = COALESCE(:allocating_org_name, allocating_organization_name),
                        notes = :notes,
                        update_date = :update_date,
                        update_user = :update_user
                    WHERE charging_site_id = :charging_site_id
                        AND create_user = :system_user
                """
            ),
            {
                    "latitude": float(location.avg_latitude)
                    if location.avg_latitude is not None
                    else None,
                    "longitude": float(location.avg_longitude)
                    if location.avg_longitude is not None
                    else None,
                    "status_id": status_id,
                    "allocating_org_name": location.allocating_org_name,
                    "notes": notes,
                    "update_date": current_time,
                    "update_user": SYSTEM_USER,
                    "charging_site_id": location.charging_site_id,
                    "system_user": SYSTEM_USER,
                },
            )
            updated += result.rowcount or 0
            continue

        site_code = next_base36(site_code, width=5)

        session.execute(
            sa.text(
                """
                INSERT INTO charging_site (
                    organization_id,
                    status_id,
                    site_code,
                    site_name,
                    street_address,
                    city,
                    postal_code,
                    latitude,
                    longitude,
                    allocating_organization_name,
                    notes,
                    group_uuid,
                    version,
                    action_type,
                    create_date,
                    update_date,
                    create_user,
                    update_user
                ) VALUES (
                    :organization_id,
                    :status_id,
                    :site_code,
                    :site_name,
                    :street_address,
                    :city,
                    :postal_code,
                    :latitude,
                    :longitude,
                    :allocating_org_name,
                    :notes,
                    :group_uuid,
                    1,
                    'CREATE',
                    :create_date,
                    :update_date,
                    :create_user,
                    :update_user
                )
                """
            ),
            {
                "organization_id": location.organization_id,
                "status_id": status_id,
                "site_code": site_code,
                "site_name": location.street_address,
                "street_address": location.street_address,
                "city": location.city,
                "postal_code": location.postal_code,
                "latitude": float(location.avg_latitude)
                if location.avg_latitude is not None
                else None,
                "longitude": float(location.avg_longitude)
                if location.avg_longitude is not None
                else None,
                "notes": notes,
                "allocating_org_name": location.allocating_org_name,
                "group_uuid": str(uuid.uuid4()),
                "create_date": current_time,
                "update_date": current_time,
                "create_user": SYSTEM_USER,
                "update_user": SYSTEM_USER,
            },
        )
        inserted += 1

    return inserted, updated


def _seed_charging_equipment(session: sa.orm.Session) -> tuple[int, int]:
    equipment_status_map, default_status_id = _get_status_map(
        session, "charging_equipment_status", "charging_equipment_status_id"
    )
    default_status_id = default_status_id or 1

    existing_max = {
        row.charging_site_id: row.max_seq
        for row in session.execute(
            sa.text(
                """
                SELECT
                    charging_site_id,
                    COALESCE(
                        MAX(
                            NULLIF(
                                REGEXP_REPLACE(equipment_number, '[^0-9]', '', 'g'),
                                ''
                            )::integer
                        ),
                        0
                    ) AS max_seq
                FROM charging_equipment
                GROUP BY charging_site_id
                """
            )
        )
    }

    equipment_rows = session.execute(
        sa.text(
            """
            SELECT
                fse.final_supply_equipment_id AS equipment_id,
                cs.charging_site_id,
                ce.charging_equipment_id AS existing_equipment_id,
                ce.equipment_number AS existing_equipment_number,
                ce.status_id AS existing_status_id,
                ce.version AS existing_version,
                CASE
                    WHEN LOWER(COALESCE(crs.status::text, '')) = 'draft' THEN 1
                    WHEN LOWER(COALESCE(crs.status::text, '')) = 'submitted' THEN 2
                    ELSE 3
                END AS status_rank,
                fse.serial_nbr,
                fse.manufacturer,
                fse.model,
                fse.level_of_equipment_id,
                fse.ports,
                fse.latitude,
                fse.longitude,
                fse.notes,
                fse.registration_nbr,
                fse.create_date,
                fse.update_date,
                fse.create_user,
                fse.update_user
            FROM final_supply_equipment fse
            JOIN compliance_report cr
                ON fse.compliance_report_id = cr.compliance_report_id
            LEFT JOIN compliance_report_status crs
                ON cr.current_status_id = crs.compliance_report_status_id
            JOIN charging_site cs
                ON cs.organization_id = cr.organization_id
                AND cs.street_address = fse.street_address
                AND cs.city = fse.city
                AND cs.postal_code = fse.postal_code
            LEFT JOIN charging_equipment ce
                ON ce.charging_equipment_id = fse.final_supply_equipment_id
            ORDER BY cs.charging_site_id, fse.final_supply_equipment_id
            """
        )
    ).fetchall()

    if not equipment_rows:
        return (0, 0)

    inserted = 0
    updated = 0
    now = datetime.now(timezone.utc)
    for row in equipment_rows:
        if row.charging_site_id is None:
            continue
        status_rank = int(row.status_rank or 3)
        status_id = _status_id_from_rank(
            status_rank, equipment_status_map, default_status_id
        )
        notes_parts = [f"FSE ID: {row.equipment_id}"]
        if row.registration_nbr:
            notes_parts.append(f"Registration: {row.registration_nbr}")
        if row.notes:
            notes_parts.append(f"Original notes: {row.notes}")
        notes = " | ".join(notes_parts)

        if row.existing_equipment_id:
            session.execute(
                sa.text(
                    """
                    UPDATE charging_equipment
                    SET
                        serial_number = :serial_number,
                        manufacturer = :manufacturer,
                        model = :model,
                        level_of_equipment_id = :level_of_equipment_id,
                        ports = :ports,
                        latitude = :latitude,
                        longitude = :longitude,
                        status_id = :status_id,
                        notes = :notes,
                        update_date = :update_date,
                        update_user = :update_user
                    WHERE charging_equipment_id = :equipment_id
                    """
                ),
                {
                    "serial_number": row.serial_nbr,
                    "manufacturer": row.manufacturer,
                    "model": row.model,
                    "level_of_equipment_id": row.level_of_equipment_id,
                    "ports": row.ports,
                    "latitude": row.latitude,
                    "longitude": row.longitude,
                    "status_id": status_id,
                    "notes": notes,
                    "update_date": now,
                    "update_user": SYSTEM_USER,
                    "equipment_id": row.equipment_id,
                },
            )
            updated += 1
            continue

        current_max = existing_max.get(row.charging_site_id, 0)
        next_seq = current_max + 1
        if next_seq > 999:
            raise ValueError(
                f"Charging site {row.charging_site_id} exceeds 3-digit equipment limit"
            )
        existing_max[row.charging_site_id] = next_seq

        session.execute(
            sa.text(
                """
                INSERT INTO charging_equipment (
                    charging_equipment_id,
                    charging_site_id,
                    status_id,
                    equipment_number,
                    serial_number,
                    manufacturer,
                    model,
                    level_of_equipment_id,
                    ports,
                    latitude,
                    longitude,
                    notes,
                    group_uuid,
                    version,
                    action_type,
                    create_date,
                    update_date,
                    create_user,
                    update_user
                ) VALUES (
                    :equipment_id,
                    :charging_site_id,
                    :status_id,
                    :equipment_number,
                    :serial_number,
                    :manufacturer,
                    :model,
                    :level_of_equipment_id,
                    :ports,
                    :latitude,
                    :longitude,
                    :notes,
                    :group_uuid,
                    1,
                    'CREATE',
                    :create_date,
                    :update_date,
                    :create_user,
                    :update_user
                )
                """
            ),
            {
                "equipment_id": row.equipment_id,
                "charging_site_id": row.charging_site_id,
                "status_id": status_id,
                "equipment_number": f"{next_seq:03d}",
                "serial_number": row.serial_nbr,
                "manufacturer": row.manufacturer,
                "model": row.model,
                "level_of_equipment_id": row.level_of_equipment_id,
                "ports": row.ports,
                "latitude": row.latitude,
                "longitude": row.longitude,
                "notes": notes,
                "group_uuid": str(uuid.uuid4()),
                "create_date": row.create_date or now,
                "update_date": row.update_date or now,
                "create_user": row.create_user or SYSTEM_USER,
                "update_user": row.update_user or SYSTEM_USER,
            },
        )
        inserted += 1

    if inserted:
        session.execute(
            sa.text(
                """
                SELECT setval(
                    pg_get_serial_sequence('charging_equipment', 'charging_equipment_id'),
                    COALESCE((SELECT MAX(charging_equipment_id) FROM charging_equipment), 1)
                )
                """
            )
        )

    return inserted, updated


def _table_exists(session: sa.orm.Session, table_name: str) -> bool:
    return (
        session.execute(
            sa.text("SELECT to_regclass(:table_name)"),
            {"table_name": f"public.{table_name}"},
        ).scalar()
        is not None
    )


def _seed_charging_site_intended_users(session: sa.orm.Session) -> int:
    if not _table_exists(session, "charging_site_intended_user_association"):
        return 0

    session.execute(
        sa.text(
            """
            DELETE FROM charging_site_intended_user_association
            WHERE charging_site_id IN (
                SELECT DISTINCT cs.charging_site_id
                FROM final_supply_equipment fse
                JOIN compliance_report cr
                    ON fse.compliance_report_id = cr.compliance_report_id
                JOIN charging_site cs
                    ON cs.organization_id = cr.organization_id
                    AND cs.street_address = fse.street_address
                    AND cs.city = fse.city
                    AND cs.postal_code = fse.postal_code
                WHERE cs.create_user = :system_user
            )
            """
        ),
        {"system_user": SYSTEM_USER},
    )

    result = session.execute(
        sa.text(
            """
            INSERT INTO charging_site_intended_user_association (
                charging_site_id,
                end_user_type_id
            )
            SELECT DISTINCT
                cs.charging_site_id,
                fsiua.end_user_type_id
            FROM final_supply_equipment fse
            JOIN compliance_report cr
                ON fse.compliance_report_id = cr.compliance_report_id
            JOIN charging_site cs
                ON cs.organization_id = cr.organization_id
                AND cs.street_address = fse.street_address
                AND cs.city = fse.city
                AND cs.postal_code = fse.postal_code
                AND cs.create_user = :system_user
            JOIN final_supply_intended_user_association fsiua
                ON fse.final_supply_equipment_id = fsiua.final_supply_equipment_id
            """
        ),
        {"system_user": SYSTEM_USER},
    )
    return _rows_affected(result)


def _seed_equipment_intended_uses(session: sa.orm.Session) -> int:
    session.execute(
        sa.text(
            """
            DELETE FROM charging_equipment_intended_use_association
            WHERE charging_equipment_id IN (
                SELECT final_supply_equipment_id FROM final_supply_equipment
            )
            """
        )
    )

    result = session.execute(
        sa.text(
            """
            INSERT INTO charging_equipment_intended_use_association (
                charging_equipment_id,
                end_use_type_id
            )
            SELECT DISTINCT
                ce.charging_equipment_id,
                fsiua.end_use_type_id
            FROM final_supply_intended_use_association fsiua
            JOIN final_supply_equipment fse
                ON fse.final_supply_equipment_id = fsiua.final_supply_equipment_id
            JOIN charging_equipment ce
                ON ce.charging_equipment_id = fse.final_supply_equipment_id
            """
        )
    )
    return _rows_affected(result)


def _seed_equipment_intended_users(session: sa.orm.Session) -> int:
    session.execute(
        sa.text(
            """
            DELETE FROM charging_equipment_intended_user_association
            WHERE charging_equipment_id IN (
                SELECT final_supply_equipment_id FROM final_supply_equipment
            )
            """
        )
    )

    result = session.execute(
        sa.text(
            """
            INSERT INTO charging_equipment_intended_user_association (
                charging_equipment_id,
                end_user_type_id
            )
            SELECT DISTINCT
                ce.charging_equipment_id,
                fsiua.end_user_type_id
            FROM final_supply_intended_user_association fsiua
            JOIN final_supply_equipment fse
                ON fse.final_supply_equipment_id = fsiua.final_supply_equipment_id
            JOIN charging_equipment ce
                ON ce.charging_equipment_id = fse.final_supply_equipment_id
            """
        )
    )
    return _rows_affected(result)


def _seed_compliance_associations(session: sa.orm.Session) -> int:
    session.execute(
        sa.text(
            """
            DELETE FROM compliance_report_charging_equipment crce
            USING final_supply_equipment fse
            WHERE crce.charging_equipment_id = fse.final_supply_equipment_id
                AND crce.compliance_report_id = fse.compliance_report_id
                AND crce.compliance_notes LIKE 'Migrated from FSE compliance association%'
            """
        )
    )

    result = session.execute(
        sa.text(
            """
            INSERT INTO compliance_report_charging_equipment (
                charging_equipment_id,
                charging_equipment_version,
                compliance_report_id,
                compliance_report_group_uuid,
                organization_id,
                supply_from_date,
                supply_to_date,
                kwh_usage,
                compliance_notes,
                create_date,
                update_date,
                create_user,
                update_user
            )
            SELECT
                fse.final_supply_equipment_id,
                ce.version,
                fse.compliance_report_id,
                cr.compliance_report_group_uuid,
                cr.organization_id,
                fse.supply_from_date::timestamp,
                fse.supply_to_date::timestamp,
                COALESCE(fse.kwh_usage, 0),
                CONCAT(
                    'Migrated from FSE compliance association',
                    CASE
                        WHEN fse.registration_nbr IS NOT NULL
                        THEN ' | Original registration: ' || fse.registration_nbr
                        ELSE ''
                    END,
                    CASE
                        WHEN fse.notes IS NOT NULL
                        THEN ' | Original notes: ' || fse.notes
                        ELSE ''
                    END
                ),
                COALESCE(fse.create_date, NOW()),
                COALESCE(fse.update_date, NOW()),
                COALESCE(fse.create_user, :system_user),
                COALESCE(fse.update_user, :system_user)
            FROM final_supply_equipment fse
            JOIN compliance_report cr
                ON fse.compliance_report_id = cr.compliance_report_id
            JOIN charging_equipment ce
                ON ce.charging_equipment_id = fse.final_supply_equipment_id
            WHERE
                fse.supply_from_date IS NOT NULL
                AND fse.supply_to_date IS NOT NULL
            """
        ),
        {"system_user": SYSTEM_USER},
    )
    return _rows_affected(result)


def _enforce_three_digit_equipment_numbers() -> None:
    op.execute(
        "ALTER TABLE charging_equipment ALTER COLUMN equipment_number TYPE VARCHAR(3)"
    )
    op.create_check_constraint(
        "ck_charging_equipment_equipment_number_3digits",
        "charging_equipment",
        "equipment_number ~ '^[0-9]{3}$'",
    )


def _drop_three_digit_constraint() -> None:
    op.drop_constraint(
        "ck_charging_equipment_equipment_number_3digits",
        "charging_equipment",
        type_="check",
    )


def _ensure_version_baseline(session: sa.orm.Session) -> None:
    session.execute(
        sa.text(
            "UPDATE charging_equipment SET version = 1 WHERE version < 1"
        )
    )
    session.execute(
        sa.text(
            "UPDATE charging_site SET version = 1 WHERE version < 1"
        )
    )


def _get_status_map(session: sa.orm.Session, table_name: str, pk_column: str):
    rows = session.execute(
        sa.text(
            f"SELECT {pk_column} AS id, LOWER(status) AS status FROM {table_name}"
        )
    ).fetchall()
    mapping: dict[str, int] = {}
    for row in rows:
        if row.status:
            mapping[row.status] = row.id
    fallback = (
        mapping.get("validated")
        or mapping.get("submitted")
        or mapping.get("draft")
        or (next(iter(mapping.values())) if mapping else None)
    )
    return mapping, fallback


def _status_id_from_rank(rank, status_map, fallback):
    if rank == 1:
        return status_map.get("draft", fallback or 1)
    if rank == 2:
        return status_map.get("submitted", fallback or 1)
    return status_map.get("validated", fallback or 1)


def _rows_affected(result: CursorResult) -> int:
    if result.rowcount is None or result.rowcount < 0:
        return 0
    return result.rowcount