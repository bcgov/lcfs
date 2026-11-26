"""
FSE reporting rows for one compliance report, read straight from the tables.

The rows are those of mv_fse_reporting_base_pref for the report: every piece of
the organization's equipment (its latest version), plus the equipment the
report group has saved reporting for, with that saved reporting. Reading them
live means a save, a new report version or an equipment edit shows on the next
read. The materialized view is refreshed in the background and only Metabase
reads it.

Each step is scoped to the report's organization and group before anything is
joined, so a report with ~1,600 pieces of equipment reads in milliseconds.
Filtering the view's own SQL by report instead takes seconds.

Saved reporting for a piece of equipment: the latest revision for each of its
versions, then, across its versions, the one saved on the latest report
version, and on the same report version the one saved last. Revision numbers
count per equipment version, so they cannot order rows saved against
different versions. An unchecked row is a save too: it wins over an older
active row, so the equipment stays excluded.
"""

import sqlalchemy as sa
from sqlalchemy.sql.selectable import Subquery

from lcfs.db.models.compliance.FSEReportingBasePrefView import (
    FSEReportingBasePrefView,
)

# The report itself.
_OWN_REPORT = """
    SELECT
        cr.compliance_report_id,
        cr.organization_id,
        cr.compliance_report_group_uuid
    FROM compliance_report cr
    WHERE cr.compliance_report_id = :compliance_report_id
"""

# The latest non-Draft version of the report's group, as in vw_fse_base. A
# group that has never been submitted has none, so it shows no rows.
_LATEST_SUBMITTED_VERSION = """
    SELECT
        cr.compliance_report_id,
        cr.organization_id,
        cr.compliance_report_group_uuid
    FROM compliance_report cr
    JOIN compliance_report_status crs
        ON crs.compliance_report_status_id = cr.current_status_id
    WHERE cr.compliance_report_group_uuid = (
            SELECT compliance_report_group_uuid
            FROM compliance_report
            WHERE compliance_report_id = :compliance_report_id
        )
      AND crs.status::text != 'Draft'
    ORDER BY cr.version DESC
    LIMIT 1
"""

# Latest version of a charging site group, for the site columns.
_LATEST_SITE = """
    SELECT
        cs.organization_id,
        cs.site_code,
        cs.site_name,
        cs.charging_site_id,
        cs.street_address,
        cs.city,
        cs.postal_code,
        cs.latitude,
        cs.longitude,
        cs.allocating_organization_name
    FROM charging_site cs
    WHERE cs.group_uuid = cs_fk.group_uuid
    ORDER BY cs.version DESC, cs.charging_site_id DESC
    LIMIT 1
"""

# Intended uses and users of one equipment version, and the charger power
# output they give.
_EQUIPMENT_DETAIL_JOINS = """
    LEFT JOIN LATERAL (
        SELECT array_agg(eut.type ORDER BY eut.type) AS intended_uses
        FROM charging_equipment_intended_use_association ceiu
        JOIN end_use_type eut ON eut.end_use_type_id = ceiu.end_use_type_id
        WHERE ceiu.charging_equipment_id = ce.charging_equipment_id
          AND ceiu.charging_equipment_version = ce.version
    ) eu ON TRUE
    LEFT JOIN LATERAL (
        SELECT array_agg(eut2.type_name ORDER BY eut2.type_name) AS intended_users
        FROM charging_equipment_intended_user_association ceiu2
        JOIN end_user_type eut2 ON eut2.end_user_type_id = ceiu2.end_user_type_id
        WHERE ceiu2.charging_equipment_id = ce.charging_equipment_id
          AND ceiu2.charging_equipment_version = ce.version
    ) eus ON TRUE
    LEFT JOIN LATERAL (
        SELECT cpo.charger_power_output AS power_output
        FROM charging_power_output cpo
        JOIN end_user_type eut_user
            ON cpo.end_user_type_id = eut_user.end_user_type_id
        LEFT JOIN end_use_type eut
            ON cpo.end_use_type_id = eut.end_use_type_id
           AND eut.type = ANY(COALESCE(eu.intended_uses, ARRAY[]::varchar[]))
        WHERE cpo.level_of_equipment_id = ce.level_of_equipment_id
          AND eut_user.type_name = ANY(
                COALESCE(eus.intended_users, ARRAY[]::varchar[])
              )
        ORDER BY cpo.display_order ASC NULLS FIRST
        LIMIT 1
    ) power_lookup ON TRUE
"""

_EQUIPMENT_COLUMNS = """
        ce.group_uuid AS charging_equipment_group_uuid,
        ce.charging_equipment_id,
        ce.version AS charging_equipment_version,
        ce.serial_number,
        ce.manufacturer,
        ce.model,
        (ls.site_code || '-' || ce.equipment_number) AS registration_number,
        ls.site_name,
        ls.charging_site_id,
        ce.notes AS equipment_notes,
        ls.street_address,
        ls.city,
        ls.postal_code,
        ls.latitude,
        ls.longitude,
        loe.name AS level_of_equipment,
        ce.level_of_equipment_id,
        ce.ports,
        ls.allocating_organization_name,
        eu.intended_uses,
        eus.intended_users,
        power_lookup.power_output,
        ces.status AS charging_equipment_status
"""

_EQUIPMENT_JOINS = f"""
    JOIN charging_site cs_fk ON cs_fk.charging_site_id = ce.charging_site_id
    JOIN LATERAL ({_LATEST_SITE}) ls ON TRUE
    JOIN level_of_equipment loe
        ON loe.level_of_equipment_id = ce.level_of_equipment_id
    JOIN charging_equipment_status ces
        ON ces.charging_equipment_status_id = ce.status_id
    {_EQUIPMENT_DETAIL_JOINS}
"""

_ROWS_SQL = """
WITH report_context AS ({report_context}),
-- Equipment on any version of a site the organization has had. The latest
-- version of each piece is found among all its versions below, and kept only
-- when its site's latest version belongs to the organization.
candidate_equipment_groups AS (
    SELECT DISTINCT ce.group_uuid
    FROM charging_equipment ce
    JOIN charging_site cs ON cs.charging_site_id = ce.charging_site_id
    WHERE cs.group_uuid IN (
        SELECT org_site.group_uuid
        FROM charging_site org_site
        WHERE org_site.organization_id = (
            SELECT organization_id FROM report_context
        )
    )
),
latest_equipment AS (
    SELECT DISTINCT ON (ce.group_uuid) ce.*
    FROM charging_equipment ce
    WHERE ce.group_uuid IN (SELECT group_uuid FROM candidate_equipment_groups)
    ORDER BY ce.group_uuid, ce.version DESC, ce.charging_equipment_id DESC
),
fallback_rows AS (
    SELECT {equipment_columns}
    FROM latest_equipment ce
    {equipment_joins}
    WHERE ls.organization_id = (SELECT organization_id FROM report_context)
),
-- Latest saved revision for each equipment version in the report group.
latest_revisions AS (
    SELECT DISTINCT ON (
        crce.charging_equipment_id,
        crce.charging_equipment_version
    )
        crce.*
    FROM compliance_report_charging_equipment crce
    WHERE crce.compliance_report_group_uuid = (
            SELECT compliance_report_group_uuid FROM report_context
        )
      AND crce.organization_id = (SELECT organization_id FROM report_context)
    ORDER BY
        crce.charging_equipment_id,
        crce.charging_equipment_version,
        crce.version DESC,
        crce.charging_equipment_compliance_id DESC
),
matched_rows AS (
    SELECT DISTINCT ON (ce.group_uuid)
        {equipment_columns},
        crce.supply_from_date,
        crce.supply_to_date,
        crce.kwh_usage,
        crce.compliance_notes,
        crce.charging_equipment_compliance_id,
        crce.is_active,
        crce.version,
        crce.action_type
    FROM latest_revisions crce
    JOIN charging_equipment ce
        ON ce.charging_equipment_id = crce.charging_equipment_id
       AND ce.version = crce.charging_equipment_version
    LEFT JOIN compliance_report saved_report
        ON saved_report.compliance_report_id = crce.compliance_report_id
    {equipment_joins}
    ORDER BY
        ce.group_uuid,
        saved_report.version DESC NULLS LAST,
        crce.charging_equipment_compliance_id DESC
),
report_equipment AS (
    SELECT charging_equipment_group_uuid FROM fallback_rows
    UNION
    SELECT charging_equipment_group_uuid FROM matched_rows
)
-- Columns in the order of FSEReportingBasePrefView: text().columns() matches
-- them by position.
SELECT
    rc.compliance_report_id,
    COALESCE(mr.charging_equipment_id, fr.charging_equipment_id)
        AS charging_equipment_id,
    COALESCE(mr.charging_equipment_version, fr.charging_equipment_version)
        AS charging_equipment_version,
    rc.organization_id,
    rc.compliance_report_group_uuid,
    COALESCE(mr.serial_number, fr.serial_number) AS serial_number,
    COALESCE(mr.manufacturer, fr.manufacturer) AS manufacturer,
    COALESCE(mr.model, fr.model) AS model,
    COALESCE(mr.registration_number, fr.registration_number)
        AS registration_number,
    COALESCE(mr.site_name, fr.site_name) AS site_name,
    COALESCE(mr.charging_site_id, fr.charging_site_id) AS charging_site_id,
    COALESCE(mr.equipment_notes, fr.equipment_notes) AS equipment_notes,
    mr.supply_from_date,
    mr.supply_to_date,
    mr.kwh_usage,
    mr.compliance_notes,
    mr.charging_equipment_compliance_id,
    mr.is_active,
    mr.version,
    mr.action_type,
    COALESCE(mr.street_address, fr.street_address) AS street_address,
    COALESCE(mr.city, fr.city) AS city,
    COALESCE(mr.postal_code, fr.postal_code) AS postal_code,
    COALESCE(mr.latitude, fr.latitude) AS latitude,
    COALESCE(mr.longitude, fr.longitude) AS longitude,
    COALESCE(mr.level_of_equipment, fr.level_of_equipment) AS level_of_equipment,
    COALESCE(mr.level_of_equipment_id, fr.level_of_equipment_id)
        AS level_of_equipment_id,
    COALESCE(mr.ports, fr.ports) AS ports,
    COALESCE(mr.allocating_organization_name, fr.allocating_organization_name)
        AS allocating_organization_name,
    {intended_uses} AS intended_uses,
    {intended_users} AS intended_users,
    COALESCE(mr.power_output, fr.power_output) AS power_output,
    CASE
        WHEN mr.kwh_usage IS NULL
             OR mr.supply_from_date IS NULL
             OR mr.supply_to_date IS NULL
             OR COALESCE(mr.power_output, fr.power_output) IS NULL
             OR COALESCE(mr.power_output, fr.power_output) <= 0
             OR mr.supply_to_date::date < mr.supply_from_date::date
        THEN NULL
        ELSE ROUND(
            (
                mr.kwh_usage::numeric
                / (
                    COALESCE(mr.power_output, fr.power_output)::numeric
                    * 24
                    * ((mr.supply_to_date::date - mr.supply_from_date::date) + 1)
                )
            ) * 100
        )::integer
    END AS capacity_utilization_percent,
    COALESCE(mr.charging_equipment_status, fr.charging_equipment_status)
        AS charging_equipment_status
FROM report_equipment re
CROSS JOIN report_context rc
LEFT JOIN fallback_rows fr
    ON fr.charging_equipment_group_uuid = re.charging_equipment_group_uuid
LEFT JOIN matched_rows mr
    ON mr.charging_equipment_group_uuid = re.charging_equipment_group_uuid
"""

_INTENDED_USES = "COALESCE(mr.intended_uses, fr.intended_uses)"
_INTENDED_USERS = "COALESCE(mr.intended_users, fr.intended_users)"
_EMPTY_LIST = "ARRAY[]::varchar[]"


def _rows_sql(latest_submitted: bool) -> str:
    return _ROWS_SQL.format(
        report_context=(_LATEST_SUBMITTED_VERSION if latest_submitted else _OWN_REPORT),
        equipment_columns=_EQUIPMENT_COLUMNS,
        equipment_joins=_EQUIPMENT_JOINS,
        # vw_fse_base lists no intended uses or users as an empty list.
        intended_uses=(
            f"COALESCE({_INTENDED_USES}, {_EMPTY_LIST})"
            if latest_submitted
            else _INTENDED_USES
        ),
        intended_users=(
            f"COALESCE({_INTENDED_USERS}, {_EMPTY_LIST})"
            if latest_submitted
            else _INTENDED_USERS
        ),
    )


_OWN_REPORT_ROWS_SQL = _rows_sql(latest_submitted=False)
_LATEST_SUBMITTED_ROWS_SQL = _rows_sql(latest_submitted=True)

_ROW_COLUMNS = [
    sa.column(column.name, column.type)
    for column in FSEReportingBasePrefView.__table__.columns
]


def fse_reporting_rows_sql(source: str = "base_pref") -> str:
    """
    SQL for the FSE reporting rows shown for a compliance report, bound to
    ``:compliance_report_id``, with the columns of mv_fse_reporting_base_pref.

    ``base_pref`` gives the report's own rows. ``vw_fse_base`` gives the rows
    of the latest non-Draft version of the report's group, with that version's
    ``compliance_report_id``, or none if the group was never submitted.
    """
    if source == "vw_fse_base":
        return _LATEST_SUBMITTED_ROWS_SQL
    if source in (None, "base_pref"):
        return _OWN_REPORT_ROWS_SQL
    raise ValueError("Invalid FSE reporting source")


def fse_reporting_rows(
    compliance_report_id: int, source: str = "base_pref"
) -> Subquery:
    """The rows of ``fse_reporting_rows_sql`` for one report, as a subquery."""
    return (
        sa.text(fse_reporting_rows_sql(source))
        .bindparams(sa.bindparam("compliance_report_id", compliance_report_id))
        .columns(*_ROW_COLUMNS)
        .subquery("fse_reporting_rows")
    )
