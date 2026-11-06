"""Refresh Metabase analytics views for current report data and visibility.

Revision ID: e5d7c9a1b3f4
Revises: ba06f9f3360c
Create Date: 2026-10-20 10:00:00
"""

import re
from pathlib import Path

from alembic import op

from lcfs.db.dependencies import parse_sql_sections

revision = "e5d7c9a1b3f4"
down_revision = "ba06f9f3360c"
branch_labels = None
depends_on = None

VIEWS_TO_REFRESH = (
    "vw_compliance_report_versions",
    "vw_compliance_reports_time_per_status",
    "vw_compliance_report_status_timeline",
    "vw_compliance_report_wip_summary",
    "vw_compliance_report_base",
    "vw_fuel_supply_analytics_base",
    "vw_fuel_supply_map",
)


def _view_definitions() -> dict[str, str]:
    sql_path = Path(__file__).resolve().parents[2] / "sql" / "views" / "metabase.sql"
    sections = parse_sql_sections(sql_path.read_text(encoding="utf-8"))
    definitions = {}
    for section in sections.values():
        for statement in section.split(";"):
            statement = re.sub(
                r"(?:^\s*--[^\n]*(?:\n|$))+", "", statement
            ).strip()
            match = re.match(
                r"CREATE\s+OR\s+REPLACE\s+VIEW\s+([a-z0-9_]+)\s+AS\b",
                statement,
                re.IGNORECASE,
            )
            if match:
                definitions[match.group(1).lower()] = statement

    missing_views = set(VIEWS_TO_REFRESH) - definitions.keys()
    if missing_views:
        raise RuntimeError(
            "Could not find Metabase view definitions: "
            + ", ".join(sorted(missing_views))
        )

    return {view_name: definitions[view_name] for view_name in VIEWS_TO_REFRESH}


def _replace_once(definition: str, old: str, new: str, view_name: str) -> str:
    if definition.count(old) != 1:
        raise RuntimeError(f"Could not reverse the {view_name} definition safely")
    return definition.replace(old, new, 1)


def _downgrade_view_definitions() -> dict[str, str]:
    definitions = _view_definitions()
    definitions["vw_compliance_report_versions"] = _replace_once(
        definitions["vw_compliance_report_versions"],
        "WHERE sd.submitted_date IS NOT NULL\n  AND crs.status::text <> 'Draft'",
        "WHERE sd.submitted_date IS NOT NULL",
        "vw_compliance_report_versions",
    )
    for view_name in (
        "vw_compliance_reports_time_per_status",
        "vw_compliance_report_status_timeline",
    ):
        definitions[view_name] = _replace_once(
            definitions[view_name],
            "        JOIN compliance_report_status current_crs\n"
            "            ON cr.current_status_id = current_crs.compliance_report_status_id\n"
            "            AND current_crs.status <> 'Draft'::compliancereportstatusenum\n",
            "",
            view_name,
        )
    definitions["vw_compliance_report_wip_summary"] = _replace_once(
        definitions["vw_compliance_report_wip_summary"],
        "    WHERE\n"
        "        report_status <> 'Draft'::compliancereportstatusenum\n",
        "",
        "vw_compliance_report_wip_summary",
    )

    report_base = definitions["vw_compliance_report_base"]
    report_base_pattern = (
        r"          compliance_report_group_uuid AS group_uuid,\n"
        r"          max\(cr\.version\) AS max_version\n"
        r"        FROM\n"
        r"          compliance_report cr\n"
        r"          JOIN compliance_report_status crs\n"
        r"            ON cr\.current_status_id = crs\.compliance_report_status_id\n"
        r"            AND crs\.status <> 'Draft'::compliancereportstatusenum\n"
        r"\s*GROUP BY\n"
        r"          cr\.compliance_report_group_uuid"
    )
    report_base, replacements = re.subn(
        report_base_pattern,
        "          compliance_report_group_uuid AS group_uuid,\n"
        "          max(VERSION) AS max_version\n"
        "        FROM\n"
        "          COMPLIANCE_REPORT\n"
        "        GROUP BY\n"
        "          COMPLIANCE_REPORT.compliance_report_group_uuid",
        report_base,
        count=1,
        flags=re.IGNORECASE,
    )
    if replacements != 1:
        raise RuntimeError(
            "Could not reverse the vw_compliance_report_base definition safely"
        )
    definitions["vw_compliance_report_base"] = report_base

    fuel_supply = definitions["vw_fuel_supply_analytics_base"]
    fuel_supply = _replace_once(
        fuel_supply,
        "    WHERE\n"
        "      fs.compliance_report_id IN (SELECT compliance_report_id FROM grouped_reports)",
        "    WHERE\n"
        "      action_type <> 'DELETE'\n"
        "      AND fs.compliance_report_id IN (SELECT compliance_report_id FROM grouped_reports)",
        "vw_fuel_supply_analytics_base",
    )
    definitions["vw_fuel_supply_analytics_base"] = _replace_once(
        fuel_supply,
        "COALESCE(fc.co_processed, 'No') AS co_processed",
        "fc.co_processed",
        "vw_fuel_supply_analytics_base",
    )
    fuel_supply_map = definitions["vw_fuel_supply_map"]
    definitions["vw_fuel_supply_map"] = _replace_once(
        fuel_supply_map,
        "    FROM fuel_supply fs\n"
        "    WHERE\n"
        "      fs.compliance_report_id IN (SELECT compliance_report_id FROM grouped_reports)",
        "    FROM fuel_supply fs\n"
        "    WHERE action_type <> 'DELETE'\n"
        "    AND fs.compliance_report_id IN (SELECT compliance_report_id FROM grouped_reports)",
        "vw_fuel_supply_map",
    )
    return definitions


def upgrade() -> None:
    definitions = _view_definitions()
    for view_name in VIEWS_TO_REFRESH:
        op.execute(definitions[view_name])


def downgrade() -> None:
    definitions = _downgrade_view_definitions()
    for view_name in VIEWS_TO_REFRESH:
        op.execute(definitions[view_name])
